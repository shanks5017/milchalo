// routes/search.js
// ──────────────────────────────────────────────────────────────────────────────
// POST /api/search — RouteStitch multi-modal journey search endpoint.
//
// Responsibilities:
//   • Validate all incoming parameters with clear error messages
//   • Apply a hard 30-second timeout (never let a scraper hang the API)
//   • Call stitchEngine.stitchRoute() and return canonical response shape
//   • Map errors to appropriate HTTP status codes
//
// See: Docs/06_ERROR_HANDLING_AND_RESILIENCE.md
// ──────────────────────────────────────────────────────────────────────────────

import { Router }                       from "express";
import { stitchRoute }                  from "../algorithms/stitchEngine.js";
import { successResponse, errorResponse } from "../utils/responseShape.js";

const router = Router();

// ── Live Logs SSE Store ───────────────────────────────────────────────────────
export const logStreams = new Map();

// ── Constants ─────────────────────────────────────────────────────────────────
const SEARCH_TIMEOUT_MS = 120_000; // Hard wall — increased to 120s for scraping
const MAX_LEGS_LIMIT    = 4;       // Absolute cap on user's maxLegs input
const VALID_RANK_BY     = new Set(["fastest", "cheapest", "reliable", "all"]);

// ── Input validators ──────────────────────────────────────────────────────────

function isValidStationCode(code) {
  return typeof code === "string" && /^[A-Z]{2,5}$/i.test(code.trim());
}

function isValidDate(dateStr) {
  if (typeof dateStr !== "string") return false;
  const m = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return false;
  const [, dd, mm, yyyy] = m.map(Number);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  // Not in the distant past (more than 1 day ago)
  const d = new Date(yyyy, mm - 1, dd);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d >= yesterday;
}

/**
 * Validate and sanitize the search request body.
 * Returns { valid: true, params } or { valid: false, errors: string[] }.
 */
function validateSearchBody(body) {
  const errors = [];

  const from = (body.from || "").trim().toUpperCase();
  const to   = (body.to   || "").trim().toUpperCase();
  const date = (body.date || "").trim();
  const mode = (body.mode || "stitched").trim().toLowerCase();

  if (!from)                     errors.push("`from` is required");
  else if (!isValidStationCode(from)) errors.push("`from` must be a 2–5 letter station code (e.g. BGM)");

  if (!to)                       errors.push("`to` is required");
  else if (!isValidStationCode(to))   errors.push("`to` must be a 2–5 letter station code (e.g. SBC)");

  if (from && to && from === to) errors.push("`from` and `to` cannot be the same station");

  if (!date)                     errors.push("`date` is required (DD-MM-YYYY format)");
  else if (!isValidDate(date))   errors.push("`date` must be in DD-MM-YYYY format and not in the past");

  // Optional params with bounds-checking
  const preferredVia = body.preferredVia
    ? (body.preferredVia || "").trim().toUpperCase() || null
    : null;

  if (preferredVia && !isValidStationCode(preferredVia)) {
    errors.push("`preferredVia` must be a valid station code if provided");
  }

  const bufferMinutes = body.bufferMinutes != null
    ? parseInt(body.bufferMinutes, 10)
    : null;

  if (bufferMinutes !== null && (isNaN(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > 240)) {
    errors.push("`bufferMinutes` must be between 0 and 240 if provided");
  }

  const maxBufferMinutes = body.maxBufferMinutes != null
    ? parseInt(body.maxBufferMinutes, 10)
    : null;

  if (maxBufferMinutes !== null && (isNaN(maxBufferMinutes) || maxBufferMinutes < 0 || maxBufferMinutes > 1440)) {
    errors.push("`maxBufferMinutes` must be between 0 and 1440 if provided");
  }

  const maxLegs = body.maxLegs != null
    ? parseInt(body.maxLegs, 10)
    : 2;

  if (isNaN(maxLegs) || maxLegs < 1 || maxLegs > MAX_LEGS_LIMIT) {
    errors.push(`\`maxLegs\` must be between 1 and ${MAX_LEGS_LIMIT}`);
  }

  const rankBy = body.rankBy || "all";
  if (!VALID_RANK_BY.has(rankBy)) {
    errors.push(`\`rankBy\` must be one of: ${[...VALID_RANK_BY].join(", ")}`);
  }

  if (!["stitched", "bus", "train"].includes(mode)) {
    errors.push("`mode` must be one of: stitched, bus, train");
  }

  const sessionId = body.sessionId ? String(body.sessionId).trim() : null;

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    params: { from, to, date, preferredVia, bufferMinutes, maxBufferMinutes, maxLegs, rankBy, mode, sessionId },
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/search/logs/:sessionId
 * Server-Sent Events endpoint for live scraper logs.
 */
router.get("/logs/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  logStreams.set(sessionId, res);

  req.on("close", () => {
    logStreams.delete(sessionId);
  });
});

/**
 * POST /api/search
 *
 * Body:
 *   { from, to, date, preferredVia?, bufferMinutes?, maxLegs?, rankBy? }
 *
 * Response (success):
 *   {
 *     success: true,
 *     data: {
 *       direct:   Service[],      — direct trains/buses (no interchange)
 *       stitched: Itinerary[],    — ranked multi-leg itineraries
 *       meta:     SearchMeta
 *     }
 *   }
 */
router.post("/", async (req, res, next) => {
  // ── 1. Validate input ───────────────────────────────────────────────────
  const validation = validateSearchBody(req.body);
  if (!validation.valid) {
    return res.status(400).json(
      errorResponse(
        `Invalid search parameters: ${validation.errors.join("; ")}`,
        "search-validation"
      )
    );
  }

  const { params } = validation;

  const onLog = (msg) => {
    if (params.sessionId) {
      const stream = logStreams.get(params.sessionId);
      if (stream) {
        stream.write(`data: ${JSON.stringify({ message: msg })}\n\n`);
      }
    }
  };

  // Attach the logger so stitchEngine can use it
  params.onLog = onLog;

  // Derive maxBufferMinutes, defaulting to 120 mins if not specified
  params.maxBufferMinutes = params.maxBufferMinutes != null ? params.maxBufferMinutes : 120;

  // ── 2. Hard timeout wrapper ──────────────────────────────────────────────
  let timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error("Search timeout — took more than 30 seconds"));
    }, SEARCH_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([
      stitchRoute(params),
      timeoutPromise,
    ]);

    clearTimeout(timeoutHandle);

    // ── 3. Return success ──────────────────────────────────────────────────
    return res.json(successResponse(result));

  } catch (err) {
    clearTimeout(timeoutHandle);

    const isTimeout = err.message?.includes("timeout");

    console.error(`[search] ${isTimeout ? "TIMEOUT" : "ERROR"} for ${params.from}→${params.to}:`, err.message);

    if (isTimeout) {
      return res.status(504).json(
        errorResponse(
          "Search timed out. The route data sources are taking too long. Please try again.",
          "search-timeout"
        )
      );
    }

    // Pass unexpected errors to global handler
    next(err);
  }
});

export default router;
