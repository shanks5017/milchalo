// algorithms/graphBuilder.js
// ──────────────────────────────────────────────────────────────────────────────
// Builds the live sub-graph for the RouteStitch stitch engine.
//
// For each interchange candidate city, fires scraper calls for:
//   - origin   → candidate (train + bus)
//   - candidate → destination (train + bus)
//
// Uses Promise.allSettled — a single scraper failure never kills the search.
// Results are cached per "FROM_TO_DATE" key (5-min TTL via node-cache).
//
// See: Docs/02_SYSTEM_ARCHITECTURE.md §6, Docs/04_DATA_PIPELINE.md §4
// ──────────────────────────────────────────────────────────────────────────────

import NodeCache from "node-cache";
import { searchTrainServices } from "../services/trainLiveService.js";
import { searchBusServices } from "../services/busLiveService.js";
import { stationToCoords } from "./interchangeFinder.js";

// ── Route-pair result cache (5-min TTL) ───────────────────────────────────────
const routeCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Fetch all train + bus services for a route pair, with caching.
 *
 * @param {string} fromCode   — erail station code (can be null for bus-only)
 * @param {string} toCode     — erail station code (can be null for bus-only)
 * @param {string} date       — "DD-MM-YYYY"
 * @param {object} [fromInfo] — unified location object for origin
 * @param {object} [toInfo]   — unified location object for destination
 * @param {string[]} [scrapeModes] — which modes to scrape (default both)
 * @returns {Promise<{ trains: object[], buses: object[] }>}
 */
async function fetchRoutePair(fromCode, toCode, date, fromInfo, toInfo, scrapeModes = ['train', 'bus']) {
  // Use bus IDs as part of cache key to be safe, fallback to names if missing
  const fromKey = fromCode || fromInfo?.busId || fromInfo?.city;
  const toKey = toCode || toInfo?.busId || toInfo?.city;
  const cacheKey = `${fromKey}_${toKey}_${date}`;
  
  const cached = routeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Extract bus details
  const fromBusId = fromInfo?.busId;
  const toBusId = toInfo?.busId;
  const fromName = fromInfo?.busName || fromInfo?.city;
  const toName = toInfo?.busName || toInfo?.city;

  const doTrain = scrapeModes.includes('train');
  const doBus = scrapeModes.includes('bus');

  // Fire train + bus scrapers in parallel — both are independent
  const [trainResult, busResult] = await Promise.allSettled([
    (doTrain && fromCode && toCode) ? searchTrainServices(fromCode, toCode, date) : Promise.resolve([]),
    (doBus && fromBusId && toBusId) ? searchBusServices(fromBusId, toBusId, date, fromName, toName) : Promise.resolve([]),
  ]);

  const trains = trainResult.status === "fulfilled" ? trainResult.value : [];
  const buses = busResult.status === "fulfilled" ? busResult.value : [];
  
  const result = { 
    trains, 
    buses,
    trainError: trainResult.status === "rejected" ? trainResult.reason?.message : null,
    busError: busResult.status === "rejected" ? busResult.reason?.message : null,
  };

  // Only cache if at least one of the requests succeeded (not rejected)
  // Or if it was fulfilled but returned an empty array, that's a valid "no routes found" response
  const trainSuccess = !doTrain || trainResult.status === "fulfilled";
  const busSuccess = !doBus || busResult.status === "fulfilled";
  
  if (trainSuccess && busSuccess) {
    routeCache.set(cacheKey, result);
  }

  return result;
}

/**
 * Build the live sub-graph of services for all candidate interchange cities.
 *
 * For each candidate interchange X, fetches:
 *   - leg1: fromCode → X.stationCode (or skips if no station code known)
 *   - leg2: X.stationCode → toCode
 *
 * Also fetches direct routes (fromCode → toCode) as leg0.
 *
 * @param {object} params
 * @param {string}   params.fromCode     — origin station code
 * @param {string}   params.toCode       — destination station code
 * @param {string}   params.date         — "DD-MM-YYYY"
 * @param {object[]} params.candidates   — from interchangeFinder.findInterchangeCandidates()
 * @param {string[]} [params.scrapeModes] — modes to scrape
 * @returns {Promise<{
 *   direct: { trains: object[], buses: object[] },
 *   legs:   Map<string, { trains: object[], buses: object[] }>
 * }>}
 */
export async function buildSubgraph({ fromCode, toCode, date, candidates, onLog, scrapeModes = ['train', 'bus'] }) {
  const fromInfo = stationToCoords(fromCode);
  const toInfo   = stationToCoords(toCode);

  const fromCity = fromInfo?.city ?? null;
  const toCity   = toInfo?.city ?? null;

  // ── Direct routes (always fetched) ───────────────────────────────────────
  const directFetch = fetchRoutePair(fromCode, toCode, date, fromInfo, toInfo, scrapeModes).then(res => {
    if (onLog) onLog(`Scraped direct route ${fromCity || fromCode} → ${toCity || toCode}: ${res.trains.length} trains, ${res.buses.length} buses`);
    return res;
  });

  // ── Per-candidate leg pairs ───────────────────────────────────────────────
  // Build fetch tasks only for candidates that have a known station code
  const legTasks = [];
  for (const candidate of candidates) {
    const via = candidate.stationCode;
    const viaInfo = {
      city: candidate.name,
      busId: candidate.busId,
      busName: candidate.busName
    };

    if (!via) {
      // No station code → we can't query erail for this city; skip train leg
      // Bus-only candidates are supported if we have bus IDs
      if (viaInfo.busId && fromInfo?.busId && toInfo?.busId) {
        legTasks.push({
          via,
          viaCity: candidate.name,
          candidate,
          leg1Promise: fetchRoutePair(null, null, date, fromInfo, viaInfo, scrapeModes).then(res => {
            if (onLog) onLog(`Scraped leg ${fromCity || fromCode} → ${candidate.name}: ${res.trains.length} trains, ${res.buses.length} buses`);
            return res;
          }),
          leg2Promise: fetchRoutePair(null, null, date, viaInfo, toInfo, scrapeModes).then(res => {
            if (onLog) onLog(`Scraped leg ${candidate.name} → ${toCity || toCode}: ${res.trains.length} trains, ${res.buses.length} buses`);
            return res;
          }),
        });
      }
      continue;
    }

    legTasks.push({
      via,
      viaCity: candidate.name,
      candidate,
      leg1Promise: fetchRoutePair(fromCode, via, date, fromInfo, viaInfo, scrapeModes).then(res => {
        if (onLog) onLog(`Scraped leg ${fromCity || fromCode} → ${candidate.name}: ${res.trains.length} trains, ${res.buses.length} buses`);
        return res;
      }),
      leg2Promise: fetchRoutePair(via, toCode, date, viaInfo, toInfo, scrapeModes).then(res => {
        if (onLog) onLog(`Scraped leg ${candidate.name} → ${toCity || toCode}: ${res.trains.length} trains, ${res.buses.length} buses`);
        return res;
      }),
    });
  }

  // ── Await everything in parallel ──────────────────────────────────────────
  const allPromises = [
    directFetch,
    ...legTasks.flatMap((t) => [t.leg1Promise, t.leg2Promise]),
  ];

  await Promise.allSettled(allPromises);

  // ── Collect results ───────────────────────────────────────────────────────
  const direct = await directFetch.catch(() => ({ trains: [], buses: [] }));

  const legs = new Map(); // key: "VIA_CODE" → { leg1, leg2, candidate }
  for (const task of legTasks) {
    const leg1 = await task.leg1Promise.catch(() => ({ trains: [], buses: [] }));
    const leg2 = await task.leg2Promise.catch(() => ({ trains: [], buses: [] }));
    const key = task.via || `BUS_${task.viaCity.replace(/\s/g, "_")}`;
    legs.set(key, { leg1, leg2, candidate: task.candidate });
  }

  // Log summary for debugging (non-fatal)
  const legSummaries = [...legs.entries()].map(
    ([k, v]) =>
      `${k}: leg1(${v.leg1.trains.length}T/${v.leg1.buses.length}B) leg2(${v.leg2.trains.length}T/${v.leg2.buses.length}B)`
  );
  console.log(
    `[graphBuilder] from=${fromCode} to=${toCode} date=${date} | ` +
    `direct: ${direct.trains.length}T/${direct.buses.length}B | ` +
    `legs: [${legSummaries.join(", ")}]`
  );

  return { direct, legs };
}
