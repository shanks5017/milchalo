// algorithms/stitchEngine.js
// ──────────────────────────────────────────────────────────────────────────────
// RouteStitch Stitch Engine — the brain of the system.
//
// Takes a search request, orchestrates all sub-components, and returns ranked
// multi-modal itineraries from real live data.
//
// Pipeline:
//   1. Direct route check (always runs first, always shown)
//   2. findInterchangeCandidates() — geometry-gated city list
//   3. buildSubgraph() — parallel live data fetch
//   4. Time-windowed leg matching — connect real departing services
//   5. tierBasedDefaultBuffer() — enforce connection safety margins
//   6. Score + rank — top 3: fastest / cheapest / most reliable
//
// No LLM, no hallucination risk, no database in the hot path.
// See: Docs/03_ALGORITHM_DESIGN.md §5
// ──────────────────────────────────────────────────────────────────────────────

import {
  timeStrToMins,
  minsToTimeStr,
  resolveArrivalDate,
  absoluteMins,
} from "./geo.js";
import {
  tierBasedDefaultBuffer,
  classifyTrainTier,
  isConnectionSafe,
  connectionSlack,
} from "./delayModel.js";
import { findInterchangeCandidates } from "./interchangeFinder.js";
import { buildSubgraph } from "./graphBuilder.js";

// ── Deep-link generators ───────────────────────────────────────────────────────

function trainDeepLink(fromCode, toCode, date, trainNo) {
  // erail search URL
  const dateFormatted = date.split("-").reverse().join("-"); // YYYY-MM-DD for erail
  if (trainNo) {
    return `https://erail.in/rail/getTrains.aspx?Train_No=${trainNo}&DataSource=0&Language=0`;
  }
  return `https://erail.in/trains/${fromCode}/${toCode}`;
}

function busDeepLink(fromCity, toCity, date) {
  // RedBus search URL
  const fromSlug = (fromCity || "").toLowerCase().replace(/\s+/g, "-");
  const toSlug   = (toCity   || "").toLowerCase().replace(/\s+/g, "-");
  return `https://www.redbus.in/bus-tickets/${fromSlug}-to-${toSlug}`;
}

// ── Service normalizer ─────────────────────────────────────────────────────────
// Converts raw train/bus objects to a unified Leg format for the engine.

function normalizeTrain(t, date, fromCode, toCode) {
  const depMins = timeStrToMins(t.departureTime);
  const arrMins = timeStrToMins(t.arrivalTime);
  const arrDate = resolveArrivalDate(date, depMins, arrMins, t.travelTime);

  const lowestFare = (t.availability || [])
    .map((a) => parseInt((a.price || "₹0").replace("₹", ""), 10))
    .filter(Boolean)
    .sort((a, b) => a - b)[0] ?? null;

  return {
    mode:          "train",
    from:          t.fromStation || fromCode,
    to:            t.toStation   || toCode,
    trainNo:       t.trainNo,
    trainName:     t.trainName,
    operator:      "Indian Railways",
    runningDays:   t.runningDays,
    departure:     minsToTimeStr(depMins),
    arrivalTime:   minsToTimeStr(arrMins),
    departureDate: date,
    arrivalDate:   arrDate,
    depMins,
    arrMins,
    travelTime:    t.travelTime,
    availability:  t.availability || [],
    lowestFare,
    trainType:     t.trainType || "",
    deepLink:      trainDeepLink(fromCode, toCode, date, t.trainNo),
    dataFreshness: "live",
    dataSource:    "erail",
  };
}

function normalizeBus(b, date, fromCity, toCity) {
  const depMins = timeStrToMins(b.departureTime || b.departure);
  const arrMins = timeStrToMins(b.arrivalTime   || b.arrival);
  const arrDate = resolveArrivalDate(date, depMins, arrMins, null);

  const rawFare = b.fare || b.minFare;
  const fare = rawFare
    ? parseInt(String(rawFare).replace(/[₹,]/g, ""), 10) || null
    : null;

  return {
    mode:          "bus",
    from:          fromCity,
    to:            toCity,
    operator:      b.operator || b.travels || b.travelerAgentName || "Unknown",
    busType:       b.busType  || b.bus_type || b.busTypeName || "",
    departure:     minsToTimeStr(depMins),
    arrivalTime:   minsToTimeStr(arrMins),
    departureDate: date,
    arrivalDate:   arrDate,
    depMins,
    arrMins,
    lowestFare:    fare,
    availability:  fare ? [{ class: "Bus", price: `₹${fare}`, status: "AVAILABLE" }] : [],
    ratings:       b.ratings || b.rating || null,
    seatsLeft:     b.seatsLeft || b.seatsAvailable || b.availableSeats || null,
    deepLink:      busDeepLink(fromCity, toCity, date),
    dataFreshness: "estimated",
    dataSource:    "bus-scraper",
  };
}

// ── Itinerary scorer ───────────────────────────────────────────────────────────

/**
 * Score an itinerary on three axes: fastest, cheapest, reliable.
 * All scores are 0–1 (higher = better) for comparison purposes.
 *
 * @param {object} itinerary
 * @param {object} bounds — { minDuration, maxDuration, minCost, maxCost }
 * @returns {{ fastest: number, cheapest: number, reliable: number }}
 */
function scoreItinerary(itinerary, bounds) {
  const { totalDurationMins, totalCostMin, buffers } = itinerary;
  const { minDuration, maxDuration, minCost, maxCost } = bounds;

  const durationRange = maxDuration - minDuration || 1;
  const costRange     = maxCost - minCost || 1;

  const fastest  = 1 - (totalDurationMins - minDuration) / durationRange;
  const cheapest = 1 - (totalCostMin - minCost) / costRange;

  // Reliability = average buffer / ideal buffer — more slack = more reliable
  // (But avoid rewarding absurdly long waits — cap at 3× target buffer)
  const avgBuffer = buffers.length > 0
    ? buffers.reduce((s, b) => s + b, 0) / buffers.length
    : 60;
  const targetBuffer = 45; // minutes
  const reliable = Math.min(avgBuffer / targetBuffer, 3) / 3;

  return {
    fastest:  parseFloat(fastest.toFixed(3)),
    cheapest: parseFloat(cheapest.toFixed(3)),
    reliable: parseFloat(reliable.toFixed(3)),
  };
}

// ── Core leg-matching logic ────────────────────────────────────────────────────

/**
 * Match two leg sets into valid time-connected pairs.
 *
 * For each service on leg1 (from→via), finds all services on leg2 (via→to)
 * where departure >= arrival(leg1) + required_buffer.
 *
 * Returns all valid itinerary candidates (pre-scoring).
 *
 * @param {object[]} leg1Services  — normalized train/bus objects for leg1
 * @param {object[]} leg2Services  — normalized train/bus objects for leg2
 * @param {string}   baseDate      — search date (for absolute minute offsets)
 * @param {object}   bufferOptions — forwarded to tierBasedDefaultBuffer
 * @param {object}   candidate     — the interchange city object
 * @returns {object[]} raw 2-leg itinerary candidates
 */
function matchTwoLegs(leg1Services, leg2Services, baseDate, bufferOptions, candidate) {
  const results = [];

  // Sort leg1 by departure (ascending) for early-departure preference
  const sorted1 = [...leg1Services].sort((a, b) => a.depMins - b.depMins);

  for (const l1 of sorted1) {
    if (l1.depMins < 0) continue; // unparseable time — skip

    const l1ArrAbs = absoluteMins(l1.arrivalDate, baseDate, l1.arrMins);

    // Compute the required buffer at the interchange
    const buffer = tierBasedDefaultBuffer({
      arrivingTrainType:    l1.mode === "train" ? l1.trainType : "",
      arrivingTrainName:    l1.mode === "train" ? l1.trainName : "",
      arrivingMode:         l1.mode,
      interchangeCityName:  candidate.name,
      interchangeCityTier:  "district",
      userOverrideMinutes:  bufferOptions.userOverrideMinutes ?? null,
    });

    for (const l2 of leg2Services) {
      if (l2.depMins < 0) continue;

      const l2DepAbs = absoluteMins(l2.departureDate, baseDate, l2.depMins);
      const l2ArrAbs = absoluteMins(l2.arrivalDate,   baseDate, l2.arrMins);

      if (!isConnectionSafe(l1ArrAbs, l2DepAbs, buffer)) continue;

      const slack = connectionSlack(l1ArrAbs, l2DepAbs);
      const maxBuffer = bufferOptions.maxBufferMins ?? 120; // Default 2 hours maximum
      if (slack > maxBuffer) continue;

      const totalDuration = l2ArrAbs - absoluteMins(l1.departureDate, baseDate, l1.depMins);
      const totalCost =
        (l1.lowestFare ?? 0) + (l2.lowestFare ?? 0);

      results.push({
        legs: [l1, l2],
        totalDurationMins: totalDuration,
        totalCostMin:      totalCost,
        buffers:           [slack],
        viaCities:         [candidate.name],
        interchangeDetails:[{
          city:        candidate.name,
          state:       candidate.state,
          bufferMins:  buffer,
          slackMins:   slack,
          detourRatio: candidate.detourRatio,
        }],
      });
    }
  }

  return results;
}

/**
 * Match three leg sets into valid time-connected triples.
 * (origin→X, X→Y, Y→destination)
 *
 * @param {object[]} leg1Services
 * @param {object[]} leg2Services
 * @param {object[]} leg3Services
 * @param {string}   baseDate
 * @param {object}   bufferOptions
 * @param {object}   candidateX — first interchange
 * @param {object}   candidateY — second interchange
 * @returns {object[]} raw 3-leg itinerary candidates
 */
function matchThreeLegs(leg1Services, leg2Services, leg3Services, baseDate, bufferOptions, candidateX, candidateY) {
  const results = [];
  const sorted1 = [...leg1Services].sort((a, b) => a.depMins - b.depMins);

  for (const l1 of sorted1) {
    if (l1.depMins < 0) continue;
    const l1ArrAbs = absoluteMins(l1.arrivalDate, baseDate, l1.arrMins);

    const buffer1 = tierBasedDefaultBuffer({
      arrivingMode:        l1.mode,
      arrivingTrainType:   l1.trainType,
      arrivingTrainName:   l1.trainName,
      interchangeCityName: candidateX.name,
      userOverrideMinutes: bufferOptions.userOverrideMinutes ?? null,
    });

    const viaBranch2 = leg2Services.filter((l2) => {
      if (l2.depMins < 0) return false;
      const l2DepAbs = absoluteMins(l2.departureDate, baseDate, l2.depMins);
      if (!isConnectionSafe(l1ArrAbs, l2DepAbs, buffer1)) return false;
      
      const slack1 = connectionSlack(l1ArrAbs, l2DepAbs);
      const maxBuffer = bufferOptions.maxBufferMins ?? 120;
      if (slack1 > maxBuffer) return false;
      return true;
    });

    for (const l2 of viaBranch2) {
      const l2ArrAbs = absoluteMins(l2.arrivalDate, baseDate, l2.arrMins);
      const slack1   = connectionSlack(l1ArrAbs, absoluteMins(l2.departureDate, baseDate, l2.depMins));

      const buffer2 = tierBasedDefaultBuffer({
        arrivingMode:        l2.mode,
        arrivingTrainType:   l2.trainType,
        arrivingTrainName:   l2.trainName,
        interchangeCityName: candidateY.name,
        userOverrideMinutes: bufferOptions.userOverrideMinutes ?? null,
      });

      for (const l3 of leg3Services) {
        if (l3.depMins < 0) continue;

        const l3DepAbs = absoluteMins(l3.departureDate, baseDate, l3.depMins);
        const l3ArrAbs = absoluteMins(l3.arrivalDate,   baseDate, l3.arrMins);

        if (!isConnectionSafe(l2ArrAbs, l3DepAbs, buffer2)) continue;

        const slack2 = connectionSlack(l2ArrAbs, l3DepAbs);
        const maxBuffer = bufferOptions.maxBufferMins ?? 120;
        if (slack2 > maxBuffer) continue;

        const totalDur = l3ArrAbs - absoluteMins(l1.departureDate, baseDate, l1.depMins);
        const totalCost = (l1.lowestFare ?? 0) + (l2.lowestFare ?? 0) + (l3.lowestFare ?? 0);

        results.push({
          legs:             [l1, l2, l3],
          totalDurationMins: totalDur,
          totalCostMin:      totalCost,
          buffers:           [slack1, slack2],
          viaCities:         [candidateX.name, candidateY.name],
          interchangeDetails: [
            { city: candidateX.name, state: candidateX.state, bufferMins: buffer1, slackMins: slack1 },
            { city: candidateY.name, state: candidateY.state, bufferMins: buffer2, slackMins: slack2 },
          ],
        });
      }
    }
  }

  return results;
}

// ── Main entry point ───────────────────────────────────────────────────────────

/**
 * Stitch train and bus legs into ranked multi-modal itineraries.
 *
 * @param {object} params
 * @param {string}   params.from            — origin station code
 * @param {string}   params.to              — destination station code
 * @param {string}   params.date            — "DD-MM-YYYY"
 * @param {string}   [params.preferredVia]  — user-specified interchange
 * @param {number}   [params.bufferMinutes] — user buffer override
 * @param {number}   [params.maxLegs=3]     — 1=direct only, 2=1 change, 3=2 changes
 * @param {string}   [params.rankBy="all"]  — "fastest"|"cheapest"|"reliable"|"all"
 * @param {string}   [params.mode="stitched"] — "stitched", "bus", "train"
 * @returns {Promise<{
 *   direct:   object[],
 *   stitched: object[],
 *   meta:     object
 * }>}
 */
export async function stitchRoute({
  from,
  to,
  date,
  preferredVia     = null,
  bufferMinutes    = null,
  maxBufferMinutes = null,
  maxLegs          = 3,
  rankBy           = "all",
  mode             = "stitched",
  onLog            = null,
}) {
  const bufferOptions = { 
    userOverrideMinutes: bufferMinutes,
    maxBufferMins: maxBufferMinutes 
  };
  const startMs = Date.now();

  let scrapeModes = ['train', 'bus'];
  if (mode === 'bus') {
    maxLegs = 1;
    scrapeModes = ['bus'];
  } else if (mode === 'train') {
    maxLegs = 1;
    scrapeModes = ['train'];
  }

  // ── Step 1: Find interchange candidates ──────────────────────────────────
  let candidates = [];
  if (maxLegs >= 2) {
    if (onLog) onLog("Finding geometry-gated interchange candidates...");
    // In full stitched mode we widen the search to guarantee alternative routes
    // are found even when a direct service exists on the same corridor.
    const isFullStitch = (mode === 'stitched');
    try {
      candidates = findInterchangeCandidates(from, to, {
        detourFactor:  isFullStitch ? 2.0 : 1.4,  // wider gate — includes major hubs like SBC/MYS
        maxCandidates: isFullStitch ? 3 : 2,       // 3 = enough variety without scraping timeout
        preferredVia,
      });
      if (onLog) {
        const names = candidates.map(c => c.name).join(", ");
        onLog(`Found ${candidates.length} candidate interchange hubs: ${names}`);
      }
    } catch (e) {
      console.error("[stitchEngine] interchangeFinder error:", e.message);
      if (onLog) onLog(`Error finding interchange candidates: ${e.message}`);
    }
  }

  // ── Step 2: Build sub-graph (live data fetch) ─────────────────────────────
  if (onLog) onLog(`Building subgraph with parallel scraper tasks (mode: ${mode})...`);
  const { direct, legs } = await buildSubgraph({ fromCode: from, toCode: to, date, candidates, onLog, scrapeModes });

  // ── Step 3: Normalize direct services ────────────────────────────────────
  const fromInfo = { city: from }; // fallback city name = code
  const toInfo   = { city: to   };
  // Try to get real city names from stationToCoords
  try {
    const { stationToCoords } = await import("./interchangeFinder.js");
    const f = stationToCoords(from);
    const t = stationToCoords(to);
    if (f) fromInfo.city = f.city;
    if (t) toInfo.city   = t.city;
  } catch { /* fallback to code */ }

  const directTrains = mode !== 'bus' ? (direct.trains || []).map((t) => normalizeTrain(t, date, from, to)) : [];
  const directBuses  = mode !== 'train' ? (direct.buses  || []).map((b) => normalizeBus(b, date, fromInfo.city, toInfo.city)) : [];

  const directResults = [...directTrains, ...directBuses]
    .filter((s) => s.depMins >= 0)
    .sort((a, b) => a.depMins - b.depMins);

  // ── Step 4: Generate stitched itineraries ─────────────────────────────────
  const allCandidates = [];

  if (maxLegs >= 2) {
    for (const [viaKey, { leg1, leg2, candidate }] of legs.entries()) {
      const leg1Services = [
        ...(leg1.trains || []).map((t) => normalizeTrain(t, date, from, viaKey)),
        ...(leg1.buses  || []).map((b) => normalizeBus(b, date, fromInfo.city, candidate.name)),
      ].filter((s) => s.depMins >= 0);

      const leg2Services = [
        ...(leg2.trains || []).map((t) => normalizeTrain(t, date, viaKey, to)),
        ...(leg2.buses  || []).map((b) => normalizeBus(b, date, candidate.name, toInfo.city)),
      ].filter((s) => s.depMins >= 0);

      if (leg1Services.length === 0 || leg2Services.length === 0) continue;

      const pairs = matchTwoLegs(leg1Services, leg2Services, date, bufferOptions, candidate);
      allCandidates.push(...pairs);
    }
  }

  // ── Step 5: 3-leg routes (disabled — causes scraper timeout with multi-candidate searches)
  // TODO: re-enable when scraper results are cached. The X→Y buildSubgraph calls are
  // sequential per-pair and blow the 120s wall when candidates > 2.
  // if (maxLegs >= 3 && candidates.length >= 2) { ... }

  // ── Step 6: Score and rank ────────────────────────────────────────────────
  const validCandidates = allCandidates.filter((c) => c.totalDurationMins > 0);

  const stitchedResults = [];

  // ── Step 6: Rank and filter ───────────────────────────────────────────────
  if (onLog) onLog("Ranking and scoring itineraries...");
  if (validCandidates.length > 0) {
    const durations = validCandidates.map((i) => i.totalDurationMins);
    const costs     = validCandidates.map((c) => c.totalCostMin).filter(Boolean);

    const bounds = {
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      minCost:     costs.length ? Math.min(...costs) : 0,
      maxCost:     costs.length ? Math.max(...costs) : 0,
    };

    const scored = validCandidates.map((it) => ({
      ...it,
      score:      scoreItinerary(it, bounds),
      totalCostMin: it.totalCostMin || 0,
    }));

    // Compute a composite score that balances all axes
    const compositeScored = scored.map((it) => ({
      ...it,
      compositeScore: (it.score.fastest + it.score.cheapest + it.score.reliable) / 3,
    }));

    // Sort by composite score descending
    compositeScored.sort((a, b) => b.compositeScore - a.compositeScore);

    // Emit up to 20 unique stitched itineraries (unique by service fingerprint)
    const MAX_STITCHED = 20;
    const seenHashes = new Set();
    for (const it of compositeScored) {
      if (stitchedResults.length >= MAX_STITCHED) break;
      // Fingerprint by via-cities + first leg departure so same-train different-interchanges both show
      const hash = [
        it.viaCities ? it.viaCities.join('|') : '',
        it.legs.map((l) => `${l.mode}:${l.trainNo || l.operator}:${l.departure}`).join('|'),
      ].join('##');
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        // Label by which axis it excels in
        const axisScores = [['fastest', it.score.fastest], ['cheapest', it.score.cheapest], ['reliable', it.score.reliable]];
        const topAxis = axisScores.sort((a, b) => b[1] - a[1])[0][0];
        stitchedResults.push({ ...it, rankLabel: topAxis });
      }
    }
  }

  // ── Step 7: Format final output ───────────────────────────────────────────
  const formatItinerary = (it) => {
    const legs = it.legs.map((l) => {
      const out = { ...l };
      delete out.depMins;
      delete out.arrMins;
      delete out.trainType;
      delete out.runningDays;
      return out;
    });

    // Compute connection type: sequence of modes joined by '+'
    // e.g. [train, bus] => 'train+bus', [bus, bus] => 'bus+bus'
    const connectionType = legs.map(l => l.mode || 'unknown').join('+');

    return {
      legs,
      connectionType,
      totalDurationMins: it.totalDurationMins,
      totalCostMin:      it.totalCostMin ? `₹${it.totalCostMin}` : "Unknown",
      totalLegs:         it.legs.length,
      viaCities:         it.viaCities || [],
      bufferAtInterchange: it.buffers || [],
      interchangeDetails:  it.interchangeDetails || [],
      score:             it.score || null,
      rankLabel:         it.rankLabel || null,
    };
  };

  const elapsed = Date.now() - startMs;
  console.log(`[stitchEngine] Search complete in ${elapsed}ms | direct:${directResults.length} stitched:${stitchedResults.length}`);
  if (onLog) onLog(`Search complete in ${elapsed}ms | direct:${directResults.length} stitched:${stitchedResults.length}`);

  return {
    direct:   directResults,
    stitched: stitchedResults.map(formatItinerary),
    meta: {
      searchedOn:          new Date().toISOString(),
      searchDurationMs:    elapsed,
      interchangesTested:  candidates.length,
      candidatesFound:     validCandidates.length,
      noDirectFound:       directResults.length === 0,
      from,
      to,
      date,
    },
  };
}
