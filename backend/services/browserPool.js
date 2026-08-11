// services/browserPool.js
// ──────────────────────────────────────────────────────────────────────────────
// Shared Playwright browser instance with p-queue concurrency cap.
//
// Why this matters (ARCH §4 — critical resource-safety rule):
//   Without this, each concurrent bus scrape launches its own Chromium process.
//   Chromium alone needs 200-400MB. Three simultaneous scrapes = potential OOM.
//
// Design:
//   - One browser process, lazy-initialized on first use
//   - Each scrape gets its own fresh incognito context (isolated cookies/session)
//   - p-queue caps parallel page operations at MAX_CONCURRENT_PAGES
//   - Graceful shutdown via SIGTERM/SIGINT handlers registered at module load
//   - Auto-restart: if the shared browser crashes, next getBrowser() call re-launches it
// ──────────────────────────────────────────────────────────────────────────────

import { chromium } from "playwright";
import PQueue from "p-queue";

// ── Config ────────────────────────────────────────────────────────────────────

/** Maximum parallel page tasks. 2 is safe for a 512MB container. Tune via env. */
const MAX_CONCURRENT_PAGES = Number(process.env.MAX_CONCURRENT_PAGES) || 2;

// ── Shared state ──────────────────────────────────────────────────────────────

/** The single shared browser instance. Null until first use. */
let _browser = null;

/** Lock to prevent concurrent launches during cold-start. */
let _launchPromise = null;

// ── Concurrency queue ─────────────────────────────────────────────────────────

/**
 * Shared p-queue — all page-level operations go through this.
 * Exported for use by busScraper.js (via runInBrowser helper).
 */
export const browserQueue = new PQueue({ concurrency: MAX_CONCURRENT_PAGES });

// ── Browser lifecycle ─────────────────────────────────────────────────────────

/**
 * Get (or lazily initialize) the shared Playwright browser.
 * Thread-safe: concurrent calls during cold-start share one launch promise.
 *
 * If the browser has crashed (disconnected), transparently re-launches it.
 *
 * @returns {Promise<import('playwright').Browser>}
 */
export async function getBrowser() {
  // Reuse if alive
  if (_browser && _browser.isConnected()) return _browser;

  // If another call is already launching, wait for it
  if (_launchPromise) return _launchPromise;

  _launchPromise = chromium
    .launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Prevent /dev/shm exhaustion in containers
        "--disable-gpu",
      ],
    })
    .then((browser) => {
      _browser = browser;
      _launchPromise = null;

      // If the browser disconnects unexpectedly, clear our reference
      // so the next call triggers a clean re-launch instead of reusing a dead handle
      browser.on("disconnected", () => {
        console.warn("[browserPool] Browser disconnected — will re-launch on next request");
        _browser = null;
      });

      console.log("[browserPool] Shared Chromium browser launched");
      return browser;
    })
    .catch((err) => {
      _launchPromise = null;
      throw err;
    });

  return _launchPromise;
}

/**
 * Run an async task inside a fresh, isolated browser context.
 * The context (and its pages) are always cleaned up after the task,
 * even if it throws — preventing session/cookie leaks between scrapes.
 *
 * This is the primary entry point for busScraper.js. Using it ensures:
 *   - The shared browser is reused (no per-call chromium.launch())
 *   - Isolation: each scrape has its own cookies, storage, session
 *   - Cleanup: context is always closed when done
 *
 * @template T
 * @param {function(import('playwright').BrowserContext): Promise<T>} taskFn
 * @returns {Promise<T>}
 */
export async function runInBrowser(taskFn) {
  return browserQueue.add(async () => {
    const browser = await getBrowser();
    const context = await browser.newContext({
      // Realistic browser fingerprint to avoid bot-detection
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "en-IN",
    });

    try {
      return await taskFn(context);
    } finally {
      // Always close the context — releases all pages and their memory
      await context.close().catch((e) =>
        console.warn("[browserPool] Context close error (non-fatal):", e.message)
      );
    }
  });
}

/**
 * Gracefully shut down the shared browser.
 * Call this on SIGTERM/SIGINT to avoid zombie Chromium processes.
 */
export async function closeBrowser() {
  browserQueue.clear();
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
    console.log("[browserPool] Shared browser closed");
  }
}

// ── Process signal handlers ───────────────────────────────────────────────────
// Registered once at module load. Ensures clean shutdown in all exit scenarios.

process.once("SIGTERM", () => closeBrowser().finally(() => process.exit(0)));
process.once("SIGINT",  () => closeBrowser().finally(() => process.exit(0)));
