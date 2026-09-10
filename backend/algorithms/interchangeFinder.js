// algorithms/interchangeFinder.js
// ──────────────────────────────────────────────────────────────────────────────
// Interchange candidate finder — the hallucination-proof geographic filter.
//
// Every suggested interchange city MUST pass a geometric detour-factor test
// before any live data is fetched. This makes it mathematically impossible to
// suggest irrelevant cities (Delhi for a CBE→BGM trip fails by 5.65×).
//
// Data source: cityRegistry.json, built from INDIAN-SHAPEFILES district HQ
// GeoJSON files — 1,224 real district capitals with verified lat/lon.
//
// See: Docs/03_ALGORITHM_DESIGN.md §3, §4
// ──────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { haversineKm, isWithinDetourFactor, detourRatio } from "./geo.js";

// ── Major transit hub registry ────────────────────────────────────────────────
// These cities are disproportionately well-connected (state capitals, major rail
// junctions) and should be preferred as interchanges even if not on the shortest
// geometric midline. A hub bonus is added to their score.
const MAJOR_HUB_NAMES = new Set([
  'BANGALORE', 'BENGALURU', 'MYSORE', 'MYSURU',
  'CHENNAI', 'HYDERABAD', 'PUNE', 'MUMBAI', 'DELHI',
  'KOLKATA', 'AHMEDABAD', 'COIMBATORE', 'KOCHI', 'ERNAKULAM',
  'MADURAI', 'TRICHY', 'VIJAYAWADA', 'VISAKHAPATNAM',
  'HUBLI', 'DHARWAD', 'MANGALORE', 'MANGALURU',
  'CALICUT', 'KOZHIKODE', 'THIRUVANANTHAPURAM',
]);

function isMajorHub(cityName) {
  return MAJOR_HUB_NAMES.has((cityName || '').toUpperCase());
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load city registry once at module init ─────────────────────────────────────
// 1,224 Indian district HQs — loaded once, reused for all searches.
// Only district-tier cities are used (reliable transport hubs).
let _cityRegistry = null;
function getCityRegistry() {
  if (!_cityRegistry) {
    const raw = readFileSync(join(__dirname, "cityRegistry.json"), "utf8");
    const all = JSON.parse(raw);
    // Only district HQs are viable interchange points
    _cityRegistry = all.filter((c) => c.tier === "district" && c.lat && c.lon);
  }
  return _cityRegistry;
}

// ── Station code → Unified Location mapping ──────────────────────────────────
// Maps erail 3-letter station codes to their unified location object (containing
// bus IDs, exact coordinates, aliases, etc.).
let _unifiedLocations = null;

function getUnifiedLocations() {
  if (!_unifiedLocations) {
    try {
      const raw = readFileSync(join(__dirname, "unifiedLocations.json"), "utf8");
      const list = JSON.parse(raw);
      _unifiedLocations = {};
      for (const loc of list) {
        _unifiedLocations[loc.erailCode.toUpperCase()] = {
          city: loc.name,
          lat: loc.lat,
          lon: loc.lon,
          busId: loc.busId,
          busName: loc.busName
        };
      }
    } catch (e) {
      console.error("[interchangeFinder] Could not load unifiedLocations.json. Did you run the builder script?");
      _unifiedLocations = {};
    }
  }
  return _unifiedLocations;
}

/**
 * Resolve a station code to a unified location object.
 * Returns null if the code is unknown — callers must handle this.
 *
 * @param {string} stationCode — e.g. "BGM"
 * @returns {{ city: string, lat: number, lon: number, busId: string, busName: string } | null}
 */
export function stationToCoords(stationCode) {
  if (!stationCode) return null;
  return getUnifiedLocations()[stationCode.toUpperCase()] ?? null;
}

/**
 * Find geographically valid interchange candidate cities between two stations.
 *
 * Algorithm:
 * 1. Resolve station codes to coordinates
 * 2. Apply haversine detour-factor gate to all district HQs (the math gate)
 * 3. Sort by connectivity score (district HQs all share the same base score;
 *    proximity to the origin-destination midpoint breaks ties)
 * 4. Return top N
 *
 * @param {string} fromCode   — erail station code (origin)
 * @param {string} toCode     — erail station code (destination)
 * @param {object} [options]
 * @param {number} [options.detourFactor=1.4]  — max allowed detour ratio
 * @param {number} [options.maxCandidates=5]   — max returned candidates
 * @param {string} [options.preferredVia]      — user-specified station code
 * @returns {Array<{ name: string, state: string, lat: number, lon: number, stationCode?: string, detourRatio: number }>}
 */
export function findInterchangeCandidates(fromCode, toCode, options = {}) {
  const {
    detourFactor = 1.4,
    maxCandidates = 2,
    preferredVia = null,
  } = options;

  const origin = stationToCoords(fromCode);
  const destination = stationToCoords(toCode);

  if (!origin) {
    throw new Error(`[interchangeFinder] Unknown station code: ${fromCode}`);
  }
  if (!destination) {
    throw new Error(`[interchangeFinder] Unknown station code: ${toCode}`);
  }

  const cities = getCityRegistry();
  const directKm = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);

  // Handle the preferredVia override
  let forced = null;
  if (preferredVia) {
    const forcedCoords = stationToCoords(preferredVia);
    if (forcedCoords) {
      const ratio = detourRatio(origin, forcedCoords, destination);
      forced = {
        name: forcedCoords.city,
        state: "user-specified",
        lat: forcedCoords.lat,
        lon: forcedCoords.lon,
        stationCode: preferredVia.toUpperCase(),
        detourRatio: ratio,
        connectivity: 999, // always first
        isUserForced: true,
        isDetourWarning: ratio > detourFactor,
      };
    }
  }

  // Score all cities that pass the detour gate
  const candidates = [];
  for (const city of cities) {
    // Skip if the city IS the origin or destination (no value as interchange)
    const cityNameUpper = (city.name || "").toUpperCase();
    const originCityUpper = (origin.city || "").toUpperCase();
    const destCityUpper = (destination.city || "").toUpperCase();
    if (
      cityNameUpper === originCityUpper ||
      cityNameUpper === destCityUpper ||
      (city.hq || "").toUpperCase() === originCityUpper ||
      (city.hq || "").toUpperCase() === destCityUpper
    ) continue;

    // The hallucination gate
    if (!isWithinDetourFactor(origin, city, destination, detourFactor)) continue;

    const ratio = detourRatio(origin, city, destination);

    // Connectivity score: district HQs on the midline corridor rank higher.
    // Midpoint proximity is a proxy for being a well-connected through-station.
    const midLat = (origin.lat + destination.lat) / 2;
    const midLon = (origin.lon + destination.lon) / 2;
    const distFromMid = haversineKm(city.lat, city.lon, midLat, midLon);
    const proximityScore = 1 / (1 + distFromMid / directKm); // 0..1, higher = closer to midline

    // Find the matching station code for this city if we have it
    const unified = getUnifiedLocations();
    const matchedCode = Object.keys(unified).find(
      (code) => unified[code].city.toUpperCase() === city.name.toUpperCase() ||
                 unified[code].city.toUpperCase() === (city.hq || "").toUpperCase()
    ) ?? null;

    // Attach bus info to candidate so graphBuilder doesn't need to look it up again
    const busId = matchedCode ? unified[matchedCode].busId : null;
    const busName = matchedCode ? unified[matchedCode].busName : null;

    candidates.push({
      name: city.hq || city.name,  // HQ name is the actual city name
      districtName: city.name,
      state: city.state,
      lat: city.lat,
      lon: city.lon,
      stationCode: matchedCode,
      busId: busId,
      busName: busName,
      detourRatio: parseFloat(ratio.toFixed(3)),
      proximityScore: parseFloat(proximityScore.toFixed(3)),
      isUserForced: false,
    });
  }

  // Sort: prefer cities we have BOTH train station AND bus IDs for (fully scrapeable),
  // then major transit hubs (capitals/junctions) get a priority bonus,
  // then proximity to midline as final tiebreaker.
  // This ensures major hubs like SBC/MYS beat smaller midline towns like Mandya.
  candidates.sort((a, b) => {
    const aScore = (a.stationCode ? 2 : 0) + (a.busId ? 1 : 0);
    const bScore = (b.stationCode ? 2 : 0) + (b.busId ? 1 : 0);
    if (aScore !== bScore) return bScore - aScore;             // most-connected first
    const aHub = isMajorHub(a.name) ? 1 : 0;
    const bHub = isMajorHub(b.name) ? 1 : 0;
    if (aHub !== bHub) return bHub - aHub;                    // major hubs second
    return b.proximityScore - a.proximityScore;               // proximity last
  });

  // Deduplicate by name before slicing
  const uniqueCandidates = [];
  const seenNames = new Set();
  for (const c of candidates) {
    if (!seenNames.has(c.name)) {
      seenNames.add(c.name);
      uniqueCandidates.push(c);
    }
  }

  // Build final result — forced city always first if present
  const top = uniqueCandidates.slice(0, maxCandidates);
  return forced ? [forced, ...top.filter((c) => c.name !== forced.name)] : top;
}
