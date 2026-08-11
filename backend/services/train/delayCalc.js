/**
 * delayCalc.js
 * Pure utility — compute delay in minutes between a scheduled and actual time.
 *
 * Both values are "HH:MM" 24-hour strings as returned by NTES.
 * Returns null when either value is absent, "--", or unparseable.
 * Handles midnight crossover: e.g. scheduled=23:50, actual=00:10 → +20 min.
 */

const UNKNOWN = new Set(["--", "-", "", null, undefined]);

/**
 * @param {string|null} scheduled  "HH:MM" or "--"
 * @param {string|null} actual     "HH:MM" or "--"
 * @returns {number|null}          positive = late, negative = early, 0 = on time
 */
export function computeDelayMinutes(scheduled, actual) {
  if (UNKNOWN.has(scheduled) || UNKNOWN.has(actual)) return null;

  const toMinutes = (hhmm) => {
    const parts = String(hhmm).trim().split(":");
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  };

  const sched = toMinutes(scheduled);
  const act = toMinutes(actual);

  if (sched === null || act === null) return null;

  let diff = act - sched;

  // Midnight crossover: if diff is wildly negative, actual crossed midnight
  if (diff < -12 * 60) diff += 24 * 60;
  // If diff is wildly positive, scheduled crossed midnight (early arrival edge)
  if (diff > 12 * 60) diff -= 24 * 60;

  return diff;
}
