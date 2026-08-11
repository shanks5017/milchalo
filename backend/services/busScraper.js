// services/busScraper.js
// ──────────────────────────────────────────────────────────────────────────────
// IRCTC bus scraper using Playwright network interception.
//
// Changes from original:
//   1. Uses shared browser from browserPool.runInBrowser() instead of
//      chromium.launch() per call — prevents memory exhaustion under load.
//   2. resolveCityCode() returns null instead of throwing when city not found
//      — caller decides whether to skip or abort, not the scraper.
//   3. 300ms delay between city-code API calls — avoids hammering IRCTC
//      with simultaneous requests that trigger rate limiting.
//
// Everything else (homepage session init, network interception, data extraction,
// 15s wait loop, travelerAgentName check) is UNCHANGED — the working logic
// that proved itself in production tests is preserved exactly.
// ──────────────────────────────────────────────────────────────────────────────

import { runInBrowser } from "./browserPool.js";

// ── City-code resolution cache ────────────────────────────────────────────────
// REMOVED: City-code resolution is now handled ahead-of-time via unifiedLocations.json.
// The bus scraper now expects exact busIds, eliminating the slow on-the-fly lookup step.

// ── Rate-limit helper ─────────────────────────────────────────────────────────
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Scrapes IRCTC bus data between two cities on a given date.
 *
 * This makes it safe for Promise.allSettled() callers in graphBuilder.js
 * to treat this as a graceful "no buses found" rather than a hard failure.
 *
 * @param {string} originBusId — Exact IRCTC Bus city ID (e.g. "22866")
 * @param {string} destBusId   — Exact IRCTC Bus city ID (e.g. "22491")
 * @param {string} date        — "DD-MM-YYYY"
 * @param {string} originName  — Display name for logs (e.g. "Belagavi")
 * @param {string} destName    — Display name for logs (e.g. "Bangalore")
 * @returns {Promise<object[]>} Array of bus objects, or [] on any failure
 */
export async function scrapeIrctcBuses(originBusId, destBusId, date, originName = "Origin", destName = "Dest") {
  // If either city doesn't have an ID, bail out cleanly with []
  if (!originBusId || !destBusId) {
    console.warn(`[busScraper] Invalid bus codes: origin=${originBusId} dest=${destBusId} — returning []`);
    return [];
  }

  try {
    // runInBrowser handles: shared browser, isolated context, always-cleanup
    return await runInBrowser(async (context) => {
      const extractedData = [];
      const page = await context.newPage();

      // Step 1: Go to the homepage first to establish a session/context
      console.log(`[busScraper] Starting: ${originName} → ${destName} on ${date}`);
      await page
        .goto("https://www.bus.irctc.co.in/home", {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        })
        .catch(() => {
          console.log("[busScraper] Non-fatal timeout loading home page, continuing...");
        });

      // Step 2: Construct the final search URL using pre-calculated IDs
      const url =
        `https://www.bus.irctc.co.in/search` +
        `?originCity=${encodeURIComponent(originName)}` +
        `&originCityCode=${originBusId}` +
        `&destinationCity=${encodeURIComponent(destName)}` +
        `&destinationCityCode=${destBusId}` +
        `&departDate=${date}`;

      console.log(`[busScraper] Navigating to: ${url}`);

      // Step 4: Intercept network responses for the bus data
      // (This logic is UNCHANGED from the original working version)
      page.on("response", async (response) => {
        const req = response.request();
        if (req.resourceType() === "fetch" || req.resourceType() === "xhr") {
          try {
            const contentType = (await response.headerValue("content-type")) || "";
            if (contentType.includes("application/json")) {
              const body = await response.json();
              if (body && typeof body === "object" && Array.isArray(body.data)) {
                const busList = body.data;
                if (busList.length > 0 && busList[0].travelerAgentName) {
                  console.log(
                    `[busScraper] Intercepted ${busList.length} buses for ${originName}→${destName}`
                  );
                  extractedData.push(...busList);
                }
              }
            }
          } catch (e) {
            // Non-fatal — a single bad response shouldn't kill the scrape
            console.warn("[busScraper] Intercept parse error (non-fatal):", e.message);
          }
        }
      });

      // Step 5: Trigger the search page
      await page
        .goto(url, { waitUntil: "domcontentloaded", timeout: 25000 })
        .catch(() => {});

      // Step 6: Wait up to 25s for bus API to respond
      // (Increased from 15s because IRCTC occasionally takes ~20s under load)
      for (let i = 0; i < 25; i++) {
        if (extractedData.length > 0) break;
        await delay(1000);
      }

      console.log(
        `[busScraper] Done: ${originName}→${destName} — ${extractedData.length} buses found`
      );
      return extractedData;
    });
  } catch (error) {
    // Any unexpected error (browser crash, network error, etc.) returns []
    // Never throw — let graphBuilder.js handle this as "no buses on this leg"
    console.error(
      `[busScraper] Failed for ${originName}→${destName}: ${error.message}`
    );
    return [];
  }
}
