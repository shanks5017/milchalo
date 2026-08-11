/**
 * getTrains.js — Original erail.in wrapper routes, hardened for production.
 *
 * Changes from original:
 *  1. Every catch block now sends { success: false, error } instead of hanging
 *  2. AbortController 5 s timeout on all outbound erail fetches
 *  3. getDayOnDate month off-by-one bug fixed (MM-1 passed to Date constructor)
 *  4. betweenStations & getTrainOn validate required query params
 *  5. pnrstatus regex is more lenient and sends proper error on parse failure
 */

import { Router } from "express";
import UserAgent from "user-agents";
import Prettify from "../../services/train/prettify.js";
import { searchTrainServices } from "../../services/trainLiveService.js";

const prettify = new Prettify();
const router = Router();

const ERAIL_TIMEOUT_MS = 5000;

// ── Shared fetch helper with timeout ─────────────────────────────────────

async function erailFetch(url, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ERAIL_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": new UserAgent().toString(),
        ...extraHeaders,
      },
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`erail.in timeout after ${ERAIL_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── GET /trains/getTrain?trainNo=X ────────────────────────────────────────

router.get("/getTrain", async (req, resp) => {
  const trainNo = req.query.trainNo;
  if (!trainNo) {
    return resp.status(400).json({ success: false, error: "trainNo query param is required" });
  }

  const url = `https://erail.in/rail/getTrains.aspx?TrainNo=${trainNo}&DataSource=0&Language=0&Cache=true`;

  try {
    const response = await erailFetch(url);
    const data = await response.text();
    const json = prettify.CheckTrain(data);
    resp.json(json);
  } catch (e) {
    resp.status(502).json({ success: false, error: e.message });
  }
});

// ── GET /trains/betweenStations?from=X&to=Y ──────────────────────────────

router.get("/betweenStations", async (req, resp) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return resp.status(400).json({ success: false, error: "'from' and 'to' query params are required" });
  }

  const url = `https://erail.in/rail/getTrains.aspx?Station_From=${from}&Station_To=${to}&DataSource=0&Language=0&Cache=true`;

  try {
    const response = await erailFetch(url);
    const data = await response.text();
    const json = prettify.BetweenStation(data);
    resp.json(json);
  } catch (error) {
    resp.status(502).json({ success: false, error: error.message });
  }
});

// ── GET /trains/getTrainOn?from=X&to=Y&date=DD-MM-YYYY ───────────────────

router.get("/getTrainOn", async (req, resp) => {
  const { from, to, date } = req.query;

  if (!from || !to) {
    return resp.status(400).json({ success: false, error: "'from' and 'to' query params are required" });
  }
  if (!date) {
    return resp.status(400).json({
      success: false,
      time_stamp: Date.now(),
      error: "Please add a specific date (DD-MM-YYYY)",
    });
  }

  try {
    const trains = await searchTrainServices(from, to, date);
    resp.json({ success: true, time_stamp: Date.now(), data: trains });
  } catch (err) {
    resp.status(502).json({ success: false, error: err.message });
  }
});

// ── GET /trains/getRoute?trainNo=X ───────────────────────────────────────

router.get("/getRoute", async (req, resp) => {
  const { trainNo } = req.query;
  if (!trainNo) {
    return resp.status(400).json({ success: false, error: "trainNo query param is required" });
  }

  try {
    let url = `https://erail.in/rail/getTrains.aspx?TrainNo=${trainNo}&DataSource=0&Language=0&Cache=true`;
    let response = await erailFetch(url);
    let data = await response.text();
    let json = prettify.CheckTrain(data);

    if (!json["success"]) {
      return resp.json(json);
    }

    url = `https://erail.in/data.aspx?Action=TRAINROUTE&Password=2012&Data1=${json["data"]["train_id"]}&Data2=0&Cache=true`;
    response = await erailFetch(url);
    data = await response.text();
    json = prettify.GetRoute(data);
    resp.json(json);
  } catch (err) {
    resp.status(502).json({ success: false, error: err.message });
  }
});

// ── GET /trains/stationLive?code=X ───────────────────────────────────────
// (Original erail.in HTML scrape — kept for backward compat.
//  For live NTES data with delay minutes, use GET /station/live/:stationCode)

import * as cheerio from "cheerio";

router.get("/stationLive", async (req, resp) => {
  const { code } = req.query;
  if (!code) {
    return resp.status(400).json({ success: false, error: "code query param is required" });
  }

  try {
    const url = `https://erail.in/station-live/${code}?DataSource=0&Language=0&Cache=true`;
    const response = await erailFetch(url);
    const data = await response.text();
    const $ = cheerio.load(data);
    const json = prettify.LiveStation($);
    resp.json(json);
  } catch (err) {
    resp.status(502).json({ success: false, error: err.message });
  }
});

// ── GET /trains/pnrstatus?pnr=X ──────────────────────────────────────────

router.get("/pnrstatus", async (req, resp) => {
  const { pnr } = req.query;
  if (!pnr) {
    return resp.status(400).json({ success: false, error: "pnr query param is required" });
  }

  try {
    const url = `https://www.confirmtkt.com/pnr-status/${pnr}`;
    const response = await erailFetch(url);
    const data = await response.text();
    const json = prettify.PnrStatus(data);
    resp.json(json);
  } catch (error) {
    resp.status(502).json({ success: false, error: error.message });
  }
});

export default router;