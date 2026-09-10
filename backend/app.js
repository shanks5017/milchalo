// app.js — RouteStitch Core API entry point
// ──────────────────────────────────────────────────────────────────────────────
// Responsibilities:
//   • Load environment variables
//   • Boot Express with cors + JSON body parsing
//   • Mount route handlers
//   • Provide /health endpoint
//   • Global 404 and error handlers (no silent hangs — project policy)
// ──────────────────────────────────────────────────────────────────────────────

import express from "express";
import cors from "cors";
import { config } from "dotenv";

import searchRouter from "./routes/search.js";
import gettrainRouter from "./routes/train/getTrains.js";
import trainTrackRouter from "./routes/train/trainTrack.js";
import stationLiveRouter from "./routes/train/stationLiveNtes.js";
import locationRouter from "./routes/locations.js";
import { successResponse, errorResponse } from "./utils/responseShape.js";

// Load .env before anything that reads process.env
config();

const PORT = process.env.PORT || 3002;
const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api/search", searchRouter);
app.use("/api/trains", gettrainRouter);
app.use("/api/train/track", trainTrackRouter);
app.use("/api/station/live", stationLiveRouter);
app.use("/api/locations", locationRouter);

// ── Health check ──────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json(successResponse({ status: "ok" }));
});

// ── 404 handler ───────────────────────────────────────────────────────────────
// Must be registered AFTER all real routes so it only catches unmatched paths.
// Returns the canonical {success: false, error} shape — never a silent hang.

app.use((_req, res) => {
  res
    .status(404)
    .json(errorResponse("Route not found. See README for available endpoints."));
});

// ── Global error handler ──────────────────────────────────────────────────────
// Express requires the (err, req, res, next) 4-arg signature to recognise this
// as an error handler (even if next is unused). The eslint disable comment is
// intentional — removing the parameter changes Express's behaviour.

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[core-api] Unhandled error:", err);
  res
    .status(500)
    .json(
      errorResponse(
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
        "core-api"
      )
    );
});

// ── Start ─────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`[RouteStitch Core API] Listening on port ${PORT}`);
  console.log(`  Health  : GET  http://localhost:${PORT}/health`);
  console.log(`  Search  : POST http://localhost:${PORT}/api/search`);
});

// Disable server timeout entirely for long-running scraping tasks
server.setTimeout(0);
server.keepAliveTimeout = 0;
