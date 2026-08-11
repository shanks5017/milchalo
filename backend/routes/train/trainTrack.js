/**
 * trainTrack.js — GET /train/track/:trainNo?date=DD-MM-YYYY
 *
 * Fetches live train running status from NTES getTrainData endpoint,
 * parses the stop-by-stop timeline, computes delay minutes at every stop,
 * and (asynchronously) persists completed journeys to Supabase.
 *
 * Response shape (success):
 * {
 *   "success": true,
 *   "cached": false,
 *   "data": {
 *     "trainNo": "12951",
 *     "trainName": "MUMBAI RAJDHANI",
 *     "currentStationCode": "BRC",
 *     "statusNote": "Train is running late by 15 minutes",
 *     "timeline": [
 *       {
 *         "stationCode": "NDLS",
 *         "stationName": "NEW DELHI",
 *         "scheduledArrival": "16:25",
 *         "actualArrival": "16:30",
 *         "arrivalDelayMinutes": 5,
 *         "scheduledDeparture": "16:35",
 *         "actualDeparture": "16:40",
 *         "departureDelayMinutes": 5,
 *         "dayOfJourney": 1,
 *         "distance": 1384
 *       }
 *     ]
 *   }
 * }
 *
 * Response shape (failure):
 * { "success": false, "error": "NTES timeout after 5000ms" }
 */

import { Router } from "express";
import { fetchNtes, trainDataUrl, NtesError } from "../../services/train/ntesClient.js";
import { cache, trainKey } from "../../services/train/cache.js";
import { computeDelayMinutes } from "../../services/train/delayCalc.js";
import { logJourney } from "../../jobs/historyLogger.js";

const router = Router();

// Cache TTL for in-progress journeys: 5 min. Completed journeys: 10 min.
const CACHE_TTL_ACTIVE = 300;
const CACHE_TTL_DONE = 600;

// ── Parser ─────────────────────────────────────────────────────────────────

/**
 * NTES getTrainData returns a structure like:
 * {
 *   "errorCode": "000",
 *   "trainNo": "12951",
 *   "trainName": "MUMBAI RAJDHANI",
 *   "currentStationCode": "BRC",
 *   "currentStationName": "VADODARA JN",
 *   "trainRunning": "1",         // 1 = running, 0 = not started/completed
 *   "stnList": [
 *     {
 *       "stnCode": "NDLS",
 *       "stnName": "NEW DELHI",
 *       "schArrTime": "STARTS",    // "STARTS" for origin
 *       "actArrTime": "STARTS",
 *       "schDptTime": "16:35",
 *       "actDptTime": "16:40",
 *       "distance": 0,
 *       "dayCount": 1,
 *       "actFlag": "A",          // A=actual, S=scheduled, X=not yet
 *       "lateTime": "5"
 *     }
 *   ]
 * }
 *
 * NOTE: NTES field names are not fully documented; these are observed in
 * the wild. Fields absent in the live response are treated as "--".
 */
function parseNtesTrainData(raw) {
  // Normalize possible error codes
  const errCode = raw.errorCode ?? raw.ErrorCode ?? raw.error ?? null;
  if (errCode && errCode !== "000" && errCode !== "0") {
    const msg = raw.errorMessage ?? raw.message ?? `NTES error code ${errCode}`;
    throw new NtesError(msg);
  }

  const trainNo = raw.trainNo ?? raw.TrainNo ?? raw.trainNumber ?? "";
  const trainName = raw.trainName ?? raw.TrainName ?? "";
  const currentStationCode =
    raw.currentStationCode ?? raw.curStnCode ?? raw.CurrentStation ?? null;
  const statusNote =
    raw.statusMessage ??
    raw.trainRunningStatus ??
    raw.remarks ??
    (raw.trainRunning === "1" ? "Train is currently running" : "");

  const rawStops =
    raw.stnList ?? raw.stationList ?? raw.stops ?? raw.Stations ?? [];

  const timeline = rawStops.map((stop) => {
    const schArr = stop.schArrTime ?? stop.scheduledArrival ?? "--";
    const actArr = stop.actArrTime ?? stop.actualArrival ?? "--";
    const schDpt = stop.schDptTime ?? stop.scheduledDeparture ?? "--";
    const actDpt = stop.actDptTime ?? stop.actualDeparture ?? "--";

    // NTES uses "STARTS"/"ENDS" for origin/terminal stations
    const normalise = (t) =>
      !t || t === "STARTS" || t === "ENDS" || t === "START" || t === "END"
        ? "--"
        : t;

    const sArr = normalise(schArr);
    const aArr = normalise(actArr);
    const sDpt = normalise(schDpt);
    const aDpt = normalise(actDpt);

    return {
      stationCode: stop.stnCode ?? stop.stationCode ?? stop.code ?? "",
      stationName: stop.stnName ?? stop.stationName ?? stop.name ?? "",
      scheduledArrival: sArr,
      actualArrival: aArr,
      arrivalDelayMinutes: computeDelayMinutes(sArr, aArr),
      scheduledDeparture: sDpt,
      actualDeparture: aDpt,
      departureDelayMinutes: computeDelayMinutes(sDpt, aDpt),
      dayOfJourney: stop.dayCount ?? stop.day ?? 1,
      distance: stop.distance ?? stop.Distance ?? null,
    };
  });

  return { trainNo, trainName, currentStationCode, statusNote, timeline };
}

// ── Journey completion check ──────────────────────────────────────────────

/**
 * Returns true when the train appears to have completed its journey
 * (final stop has an actual arrival that isn't "--").
 */
function isJourneyComplete(timeline) {
  if (!timeline.length) return false;
  const last = timeline[timeline.length - 1];
  return last.actualArrival !== "--" && last.actualArrival !== null;
}

// ── Route ─────────────────────────────────────────────────────────────────

router.get("/:trainNo", async (req, res) => {
  const { trainNo } = req.params;
  const date = req.query.date ?? null; // DD-MM-YYYY, optional

  if (!trainNo || !/^\d{4,5}$/.test(trainNo)) {
    return res.status(400).json({
      success: false,
      error: "trainNo must be a 4-5 digit number",
    });
  }

  const cacheKey = trainKey(trainNo, date);

  // ── Cache hit ──
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ success: true, cached: true, data: cached });
  }

  // ── NTES call ──
  const url = trainDataUrl(trainNo, date);
  let parsed;

  try {
    const raw = await fetchNtes(url);
    parsed = parseNtesTrainData(raw);
  } catch (err) {
    const message =
      err instanceof NtesError
        ? err.message
        : `Unexpected error: ${err.message}`;
    console.error(`[trainTrack] ${message}`, { trainNo, date });
    return res.status(502).json({ success: false, error: message });
  }

  // ── Cache store ──
  const complete = isJourneyComplete(parsed.timeline);
  cache.set(cacheKey, parsed, complete ? CACHE_TTL_DONE : CACHE_TTL_ACTIVE);

  // ── History persistence (fire-and-forget) ──
  if (complete) {
    const finalStop = parsed.timeline[parsed.timeline.length - 1];
    const finalDelay =
      finalStop.arrivalDelayMinutes ?? finalStop.departureDelayMinutes ?? null;

    logJourney({
      trainNo,
      journeyDate: date ?? new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
      timeline: parsed.timeline,
      finalDelayMinutes: finalDelay,
    });
  }

  return res.json({ success: true, cached: false, data: parsed });
});

export default router;
