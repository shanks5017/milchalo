// algorithms/delayModel.js
// ──────────────────────────────────────────────────────────────────────────────
// Tier-based connection buffer model for RouteStitch.
//
// Core principle: every interchange needs a safety margin (buffer) between
// leg1 arrival and leg2 departure. This buffer accounts for real-world delays,
// platform chaos, and the cost of a missed connection.
//
// Buffer is deterministic math — NOT an LLM judgment call.
// See: Docs/03_ALGORITHM_DESIGN.md §6, Docs/07_LLM_INTEGRATION.md §3
// ──────────────────────────────────────────────────────────────────────────────

// ── Train type tier matrix ─────────────────────────────────────────────────────
// Derived from: train name keywords from erail data (trainType / train_name)
// Higher tier = more reliable = tighter buffer acceptable

const TRAIN_TIER_BUFFER_MINS = {
  // Tier A: Premium, dedicated tracks, near-guaranteed punctuality
  VANDE_BHARAT: 15,
  RAJDHANI:     15,
  SHATABDI:     15,
  TEJAS:        15,
  GATIMAAN:     15,
  // Tier B: Superfast, generally punctual
  SUPERFAST:    25,
  HUMSAFAR:     25,
  DURONTO:      20,
  SUVIDHA:      25,
  GARIB_RATH:   25,
  // Tier C: Express / Mail — most common, moderate delays
  EXPRESS:      35,
  MAIL:         35,
  INTERCITY:    30,
  JAN_SHATABDI: 30,
  // Tier D: Passenger / MEMU / DEMU / local — most delay-prone
  PASSENGER:    50,
  MEMU:         45,
  DEMU:         45,
  LOCAL:        50,
  // Tier E: Bus — no fixed tracks, traffic-dependent
  BUS:          40,
};

// ── City tier adjustment ───────────────────────────────────────────────────────
// Bigger cities have more platform/traffic chaos at the interchange
const CITY_TIER_ADJUSTMENT_MINS = {
  district:     5,   // District HQ — moderate hub
  subdistrict:  0,   // Smaller town — less chaos
  metro:        10,  // Metro city — high chaos (handled via city name match)
};

// Known metro cities for the +10 min chaos bonus
const METRO_CITIES = new Set([
  "MUMBAI", "DELHI", "BENGALURU", "BANGALORE", "HYDERABAD", "AHMEDABAD",
  "PUNE", "CHENNAI", "KOLKATA", "SURAT", "JAIPUR", "LUCKNOW",
]);

/**
 * Classify a train by its type tier, using the trainType string from erail
 * (data field [32] in the raw payload, e.g. "SUPERFAST", "MAIL_EXPRESS").
 *
 * @param {string} trainType  — erail train type string (from `t.trainType`)
 * @param {string} trainName  — full train name (fallback keyword match)
 * @returns {string} Tier key matching TRAIN_TIER_BUFFER_MINS
 */
export function classifyTrainTier(trainType, trainName) {
  const combined = `${trainType || ""} ${trainName || ""}`.toUpperCase();

  // Specific markers first (order matters — most specific at top)
  if (combined.includes("VANDE") || combined.includes("VANDE BHARAT")) return "VANDE_BHARAT";
  if (combined.includes("RAJDHANI"))    return "RAJDHANI";
  if (combined.includes("SHATABDI") || combined.includes("JAN SHATABDI")) return "SHATABDI";
  if (combined.includes("JAN SHATABDI")) return "JAN_SHATABDI";
  if (combined.includes("TEJAS"))       return "TEJAS";
  if (combined.includes("GATIMAAN"))    return "GATIMAAN";
  if (combined.includes("HUMSAFAR"))    return "HUMSAFAR";
  if (combined.includes("DURONTO"))     return "DURONTO";
  if (combined.includes("SUVIDHA"))     return "SUVIDHA";
  if (combined.includes("GARIB RATH"))  return "GARIB_RATH";
  if (combined.includes("SUPERFAST") || combined.includes("SF EXP")) return "SUPERFAST";
  if (combined.includes("INTERCITY"))   return "INTERCITY";
  if (combined.includes("EXPRESS") || combined.includes("EXP")) return "EXPRESS";
  if (combined.includes("MAIL"))        return "MAIL";
  if (combined.includes("MEMU"))        return "MEMU";
  if (combined.includes("DEMU"))        return "DEMU";
  if (combined.includes("PASSENGER") || combined.includes("PASS")) return "PASSENGER";
  if (combined.includes("LOCAL"))       return "LOCAL";

  // Default fallback — conservative express buffer
  return "EXPRESS";
}

/**
 * Return the recommended buffer in minutes for a connection at an interchange.
 *
 * The arriving leg's tier determines the base buffer (how reliable it is).
 * The interchange city's tier adds an overhead for platform/traffic chaos.
 * The user's explicit override always wins if provided.
 *
 * @param {object} options
 * @param {string}  options.arrivingTrainType  — erail trainType of the arriving leg
 * @param {string}  options.arrivingTrainName  — train name for keyword matching
 * @param {string}  options.arrivingMode       — "train" | "bus"
 * @param {string}  options.interchangeCityName — city name string
 * @param {string}  options.interchangeCityTier — "district" | "subdistrict"
 * @param {number|null} options.userOverrideMinutes — user-specified buffer
 * @returns {number} Buffer in minutes
 */
export function tierBasedDefaultBuffer({
  arrivingTrainType = "",
  arrivingTrainName = "",
  arrivingMode = "train",
  interchangeCityName = "",
  interchangeCityTier = "district",
  userOverrideMinutes = null,
}) {
  // User override always wins — product rule
  if (typeof userOverrideMinutes === "number" && userOverrideMinutes >= 0) {
    return userOverrideMinutes;
  }

  // Base buffer from arriving leg type
  let base;
  if (arrivingMode === "bus") {
    base = TRAIN_TIER_BUFFER_MINS.BUS;
  } else {
    const tier = classifyTrainTier(arrivingTrainType, arrivingTrainName);
    base = TRAIN_TIER_BUFFER_MINS[tier] ?? TRAIN_TIER_BUFFER_MINS.EXPRESS;
  }

  // City chaos adjustment
  const cityUpper = interchangeCityName.toUpperCase().trim();
  const adjustment = METRO_CITIES.has(cityUpper)
    ? CITY_TIER_ADJUSTMENT_MINS.metro
    : (CITY_TIER_ADJUSTMENT_MINS[interchangeCityTier] ?? 0);

  return base + adjustment;
}

/**
 * Check if a connection is safe given arrival, departure, and required buffer.
 *
 * Uses absolute minutes (cross-day aware via geo.absoluteMins) so overnight
 * trains are handled correctly.
 *
 * @param {number} arrivalAbsMins  — absolute mins since search base date
 * @param {number} departureAbsMins — absolute mins since search base date
 * @param {number} bufferMins
 * @returns {boolean}
 */
export function isConnectionSafe(arrivalAbsMins, departureAbsMins, bufferMins) {
  return departureAbsMins >= arrivalAbsMins + bufferMins;
}

/**
 * Compute the actual buffer (slack) at a connection point.
 * Positive = safe. Negative = missed connection.
 *
 * @param {number} arrivalAbsMins
 * @param {number} departureAbsMins
 * @returns {number} Slack in minutes
 */
export function connectionSlack(arrivalAbsMins, departureAbsMins) {
  return departureAbsMins - arrivalAbsMins;
}
