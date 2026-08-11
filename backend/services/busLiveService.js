// services/busLiveService.js
// ──────────────────────────────────────────────────────────────────────────────
// PLACEHOLDER — no real logic yet.
//
// Will call the Python/Selenium bus service (bus/ directory) over HTTP.
// The bus service URL is configured via BUS_SERVICE_URL env variable.
//
// Note: the bus/ module currently runs Selenium scrapes directly; it will need
// to expose a small FastAPI/Flask wrapper before this service can call it.
// ──────────────────────────────────────────────────────────────────────────────

import { scrapeIrctcBuses } from "./busScraper.js";
import PQueue from "p-queue";

// Force strictly sequential scraping (1 at a time) to prevent IRCTC API rate limits/blocks
const busQueue = new PQueue({ concurrency: 1 });

/**
 * Search for bus services between two cities on a date.
 *
 * @param {string} originBusId
 * @param {string} destBusId
 * @param {string} date - DD-MM-YYYY format
 * @param {string} originName
 * @param {string} destName
 * @returns {Promise<object[]>} Array of bus service objects
 */
export async function searchBusServices(originBusId, destBusId, date, originName, destName) {
  try {
    const buses = await busQueue.add(() => scrapeIrctcBuses(originBusId, destBusId, date, originName, destName));
    return buses;
  } catch (error) {
    console.error("[busLiveService] Error:", error.message);
    throw error;
  }
}
