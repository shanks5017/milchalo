/**
 * stationLiveNtes.js — GET /station/live/:stationCode?hours=2
 *
 * Fetches the live station board from NTES, filters trains within the
 * requested time window, and annotates each with delay minutes.
 *
 * Response shape (success):
 * {
 *   "success": true,
 *   "cached": false,
 *   "data": {
 *     "stationCode": "NDLS",
 *     "stationName": "NEW DELHI",
 *     "asOf": "2026-07-15T15:17:00+05:30",
 *     "windowHours": 2,
 *     "trains": [
 *       {
 *         "trainNo": "12951",
 *         "trainName": "MUMBAI RAJDHANI",
 *         "scheduledArrival": "16:25",
 *         "actualArrival": "16:30",
 *         "arrivalDelayMinutes": 5,
 *         "scheduledDeparture": "16:35",
 *         "actualDeparture": "16:40",
 *         "departureDelayMinutes": 5,
 *         "platform": "3",
 *         "status": "ARRIVED",
 *         "sourceStation": "NDLS",
 *         "destinationStation": "BCT"
 *       }
 *     ]
 *   }
 * }
 *
 * Response shape (failure):
 * { "success": false, "error": "NTES timeout after 5000ms" }
 */

import { Router } from "express";
import { fetchNtes, stationBoardUrl, NtesError } from "../../services/train/ntesClient.js";
import { cache, stationKey } from "../../services/train/cache.js";
import { computeDelayMinutes } from "../../services/train/delayCalc.js";

const router = Router();

const CACHE_TTL = 300; // 5 min

// ── Time window filter ────────────────────────────────────────────────────

/**
 * Given a "HH:MM" string and a current time, decide whether the train
 * falls within ±windowHours of now.
 *
 * @param {string}  timeStr     "HH:MM" or "--"
 * @param {Date}    now
 * @param {number}  windowHours
 */
function isWithinWindow(timeStr, now, windowHours) {
  if (!timeStr || timeStr === "--") return false;
  const parts = timeStr.split(":");
  if (parts.length < 2) return false;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return false;

  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);

  // Handle midnight rollover: if candidate is wildly in the past, push it fwd
  const diffMs = candidate - now;
  if (diffMs < -12 * 60 * 60 * 1000) candidate.setDate(candidate.getDate() + 1);

  const windowMs = windowHours * 60 * 60 * 1000;
  return Math.abs(candidate - now) <= windowMs;
}

// ── Parser ────────────────────────────────────────────────────────────────

/**
 * NTES station board response shape (observed):
 * {
 *   "errorCode": "000",
 *   "stationCode": "NDLS",
 *   "stationName": "NEW DELHI",
 *   "trainList": [
 *     {
 *       "trainNo": "12951",
 *       "trainName": "MUMBAI RAJDHANI",
 *       "schArrTime": "16:25",
 *       "actArrTime": "16:30",
 *       "schDptTime": "16:35",
 *       "actDptTime": "16:40",
 *       "platform": "3",
 *       "trainStatus": "ARRIVED",
 *       "srcCode": "NDLS",
 *       "dstCode": "BCT",
 *       "lateTime": "5"
 *     }
 *   ]
 * }
 */
function parseStationBoard(raw, windowHours) {
  const errCode = raw.errorCode ?? raw.ErrorCode ?? raw.error ?? null;
  if (errCode && errCode !== "000" && errCode !== "0") {
    const msg = raw.errorMessage ?? raw.message ?? `NTES error code ${errCode}`;
    throw new NtesError(msg);
  }

  const stationCode = raw.stationCode ?? raw.stnCode ?? "";
  const stationName = raw.stationName ?? raw.stnName ?? "";

  const rawTrains =
    raw.trainList ?? raw.TrainList ?? raw.trains ?? raw.data ?? [];

  const now = new Date();

  const trains = rawTrains
    .map((t) => {
      const schArr = t.schArrTime ?? t.scheduledArrival ?? "--";
      const actArr = t.actArrTime ?? t.actualArrival ?? "--";
      const schDpt = t.schDptTime ?? t.scheduledDeparture ?? "--";
      const actDpt = t.actDptTime ?? t.actualDeparture ?? "--";

      const normalise = (v) =>
        !v || v === "STARTS" || v === "ENDS" ? "--" : v;

      const sArr = normalise(schArr);
      const aArr = normalise(actArr);
      const sDpt = normalise(schDpt);
      const aDpt = normalise(actDpt);

      return {
        trainNo: t.trainNo ?? t.TrainNo ?? "",
        trainName: t.trainName ?? t.TrainName ?? "",
        scheduledArrival: sArr,
        actualArrival: aArr,
        arrivalDelayMinutes: computeDelayMinutes(sArr, aArr),
        scheduledDeparture: sDpt,
        actualDeparture: aDpt,
        departureDelayMinutes: computeDelayMinutes(sDpt, aDpt),
        platform: t.platform ?? t.Platform ?? t.pfNo ?? null,
        status: t.trainStatus ?? t.status ?? t.Status ?? null,
        sourceStation: t.srcCode ?? t.sourceStation ?? null,
        destinationStation: t.dstCode ?? t.destinationStation ?? null,
      };
    })
    .filter((t) => {
      // Keep trains whose scheduled arrival OR departure falls in the window
      return (
        isWithinWindow(t.scheduledArrival, now, windowHours) ||
        isWithinWindow(t.scheduledDeparture, now, windowHours)
      );
    });

  return { stationCode, stationName, trains };
}

// ── Route ─────────────────────────────────────────────────────────────────

router.get("/:stationCode", async (req, res) => {
  const stationCode = (req.params.stationCode ?? "").toUpperCase();
  const windowHours = Math.min(Math.max(parseFloat(req.query.hours ?? "2"), 0.5), 24);

  if (!stationCode || !/^[A-Z]{2,5}$/.test(stationCode)) {
    return res.status(400).json({
      success: false,
      error: "stationCode must be 2-5 uppercase letters (e.g. NDLS, BRC)",
    });
  }

  const cacheKey = stationKey(stationCode, windowHours);

  // ── Cache hit ──
  const cached = cache.get(cacheKey);
  if (cached) {
    return res.json({ success: true, cached: true, data: cached });
  }

  const url = stationBoardUrl(stationCode);
  let parsed;

  try {
    const raw = await fetchNtes(url);
    parsed = parseStationBoard(raw, windowHours);
  } catch (err) {
    const message =
      err instanceof NtesError
        ? err.message
        : `Unexpected error: ${err.message}`;
    console.error(`[stationLive] ${message}`, { stationCode });
    return res.status(502).json({ success: false, error: message });
  }

  const payload = {
    stationCode,
    stationName: parsed.stationName || stationCode,
    asOf: new Date().toISOString(),
    windowHours,
    trains: parsed.trains,
  };

  cache.set(cacheKey, payload, CACHE_TTL);

  return res.json({ success: true, cached: false, data: payload });
});

export default router;
