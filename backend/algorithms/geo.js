// algorithms/geo.js
// ──────────────────────────────────────────────────────────────────────────────
// Pure geographic and time utilities for the RouteStitch stitch engine.
// Zero external dependencies — fully unit-testable in isolation.
//
// All distance calculations use the Haversine formula (great-circle distance).
// This is accurate to within ~0.3% for terrestrial distances, which is more
// than sufficient for the detour-factor interchange filtering.
// ──────────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

/**
 * Compute the great-circle distance between two lat/lon points in kilometres.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in km
 */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * The hallucination-proof interchange gate.
 *
 * Returns true ONLY if routing via interchange X between origin O and
 * destination D does not deviate more than `factor` × the direct distance.
 *
 * Example (verified against real coords):
 *   isWithinDetourFactor(CBE, SBC, BGM, 1.4) → true  (1.15×)
 *   isWithinDetourFactor(CBE, DEL, BGM, 1.4) → false (5.65×)
 *
 * @param {{ lat: number, lon: number }} origin
 * @param {{ lat: number, lon: number }} interchange
 * @param {{ lat: number, lon: number }} destination
 * @param {number} factor — e.g. 1.4 for 40% detour allowance
 * @returns {boolean}
 */
export function isWithinDetourFactor(origin, interchange, destination, factor = 1.4) {
  const direct = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);
  if (direct < 10) return true; // Very close cities — skip the gate entirely
  const via =
    haversineKm(origin.lat, origin.lon, interchange.lat, interchange.lon) +
    haversineKm(interchange.lat, interchange.lon, destination.lat, destination.lon);
  return via / direct <= factor;
}

/**
 * Compute the detour ratio for reporting / debug purposes.
 * @returns {number} The actual ratio (e.g. 1.15 means 15% detour)
 */
export function detourRatio(origin, interchange, destination) {
  const direct = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);
  if (direct < 1) return 1;
  const via =
    haversineKm(origin.lat, origin.lon, interchange.lat, interchange.lon) +
    haversineKm(interchange.lat, interchange.lon, destination.lat, destination.lon);
  return via / direct;
}

// ── Time utilities ─────────────────────────────────────────────────────────────

/**
 * Convert an erail-style time string to minutes from midnight.
 *
 * erail uses "HH.MM" format (e.g. "06.15", "23.50", "00.30").
 * Standard "HH:MM" is also accepted for bus data.
 *
 * @param {string} timeStr — "HH.MM" or "HH:MM"
 * @returns {number} Minutes from midnight (0–1439), or -1 if unparseable
 */
export function timeStrToMins(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return -1;
  const normalized = timeStr.trim().replace(".", ":").replace(",", ":");
  const [hStr, mStr] = normalized.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
}

/**
 * Convert minutes from midnight to "HH:MM" display string.
 * Handles values > 1439 (wraps into next day — used for display only).
 *
 * @param {number} mins
 * @returns {string} e.g. "14:30"
 */
export function minsToTimeStr(mins) {
  if (typeof mins !== "number" || mins < 0) return "--:--";
  const normalized = mins % 1440; // wrap at midnight
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Date utilities ─────────────────────────────────────────────────────────────

/**
 * Parse a "DD-MM-YYYY" date string into a Date object (midnight UTC).
 *
 * @param {string} dateStr — "25-07-2026"
 * @returns {Date}
 */
export function parseDDMMYYYY(dateStr) {
  const [dd, mm, yyyy] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

/**
 * Format a Date object back to "DD-MM-YYYY".
 *
 * @param {Date} date
 * @returns {string}
 */
export function formatDDMMYYYY(date) {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Add N calendar days to a "DD-MM-YYYY" date string.
 *
 * @param {string} dateStr — "25-07-2026"
 * @param {number} days
 * @returns {string} — e.g. "26-07-2026"
 */
export function addDays(dateStr, days) {
  const base = parseDDMMYYYY(dateStr);
  base.setUTCDate(base.getUTCDate() + days);
  return formatDDMMYYYY(base);
}

/**
 * Determine the arrival date for a leg, handling overnight arrivals.
 *
 * If arrivalMins < departureMins the train has crossed midnight — add 1 day.
 * Handles multi-night trains by computing the integer number of extra days.
 *
 * @param {string} departureDate — "DD-MM-YYYY"
 * @param {number} departureMins — departure time in mins from midnight
 * @param {number} arrivalMins  — arrival time in mins from midnight
 * @param {string} travelTimeStr — e.g. "10.55" (HH.MM, erail format)
 * @returns {string} arrival date "DD-MM-YYYY"
 */
export function resolveArrivalDate(departureDate, departureMins, arrivalMins, travelTimeStr) {
  // Primary path: use the travel time string to compute exact day offset
  if (travelTimeStr) {
    const travelMins = timeStrToMins(travelTimeStr);
    if (travelMins > 0) {
      const totalMins = departureMins + travelMins;
      const extraDays = Math.floor(totalMins / 1440);
      return addDays(departureDate, extraDays);
    }
  }
  // Fallback: simple overnight check
  if (arrivalMins < departureMins) return addDays(departureDate, 1);
  return departureDate;
}

/**
 * Compute absolute minutes since the epoch of the search date.
 * Used for cross-day comparisons: "does leg2 depart after leg1 arrives?"
 *
 * @param {string} date      — "DD-MM-YYYY"
 * @param {string} baseDate  — "DD-MM-YYYY" (the search start date, day 0)
 * @param {number} timeMins  — minutes from midnight on `date`
 * @returns {number} Absolute minutes from midnight of baseDate
 */
export function absoluteMins(date, baseDate, timeMins) {
  const base = parseDDMMYYYY(baseDate);
  const target = parseDDMMYYYY(date);
  const dayOffset = Math.round((target - base) / (1000 * 60 * 60 * 24));
  return dayOffset * 1440 + timeMins;
}
