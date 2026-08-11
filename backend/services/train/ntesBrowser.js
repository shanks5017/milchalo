/**
 * ntesBrowser.js
 * Playwright-based NTES data fetcher — fallback for when Node's HTTP stack
 * can't deal with NTES's malformed HTTP/1.1 response (missing CR before LF).
 *
 * ## Root cause
 * enquiry.indianrail.gov.in sends bare-LF HTTP/1.1 responses:
 *   "HTTP/1.1 200 OK\n"  (should be "HTTP/1.1 200 OK\r\n")
 * Every Node.js HTTP client rejects this (fetch, node:https, axios, and even
 * Playwright's route.fetch() which proxies through Node).
 *
 * ## Solution: page.evaluate() fetch() from inside the browser sandbox
 * We navigate Chromium to the NTES landing page (establishes session cookies),
 * then call window.fetch() for the API URL from INSIDE the browser context
 * via page.evaluate(). Chromium's own JS fetch() is lenient about bare-LF and
 * returns the JSON payload. The result is serialized and passed back to Node.
 *
 * ## Architecture
 * - Singleton browser (one Chromium per Node process)
 * - Isolated BrowserContext per call (cookie isolation)
 * - Landing page navigation → cookie harvest
 * - page.evaluate(url => fetch(url).then(r => r.text()), apiUrl)
 */

import { chromium } from "playwright";

// ── Singleton browser ─────────────────────────────────────────────────────────

let _browser = null;
let _launching = null;

async function getBrowser() {
  if (_browser?.isConnected()) return _browser;
  if (_launching) return _launching;

  _launching = chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
    ],
  }).then((b) => {
    _browser = b;
    _launching = null;
    console.log("[ntesBrowser] Chromium launched");
    return b;
  }).catch((e) => {
    _launching = null;
    throw e;
  });

  return _launching;
}

export async function shutdownBrowser() {
  if (_browser?.isConnected()) {
    await _browser.close();
    _browser = null;
    console.log("[ntesBrowser] Chromium shut down");
  }
}

process.on("exit", () => { if (_browser?.isConnected()) _browser.close(); });
process.on("SIGTERM", async () => { await shutdownBrowser(); process.exit(0); });
process.on("SIGINT",  async () => { await shutdownBrowser(); process.exit(0); });

// ── JS-wrapper stripper ───────────────────────────────────────────────────────

function stripJsWrapper(text) {
  const trimmed = text.trim();
  const jsonpMatch = trimmed.match(/^[a-zA-Z_$][a-zA-Z0-9_$.]*\s*\(([\s\S]*)\)\s*;?\s*$/);
  if (jsonpMatch) return jsonpMatch[1].trim();
  const varMatch = trimmed.match(/^var\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*([\s\S]+?);\s*$/);
  if (varMatch) return varMatch[1].trim();
  if (trimmed.endsWith(";") && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return trimmed.slice(0, -1).trim();
  }
  return trimmed;
}

// ── Core fetcher ──────────────────────────────────────────────────────────────

const NTES_LANDING = "https://enquiry.indianrail.gov.in/ntes/NTES";

/**
 * Fetch an NTES API URL using window.fetch() INSIDE Chromium via page.evaluate().
 *
 * This completely bypasses Node's HTTP parser — the fetch runs in the browser's
 * JS sandbox. Chromium is lenient about bare-LF HTTP responses and will return
 * the JSON body correctly.
 *
 * @param {string}  apiUrl
 * @param {number}  [timeoutMs=25000]
 * @returns {Promise<object>}
 */
export async function fetchNtesBrowser(apiUrl, timeoutMs = 25000) {
  const browser = await getBrowser();

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
      "DNT": "1",
    },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  try {
    // Step 1: Navigate to NTES landing to establish session cookies.
    // We use domcontentloaded (not load / networkidle) for speed.
    console.log("[ntesBrowser] Establishing NTES session...");
    await page.goto(NTES_LANDING, {
      waitUntil: "domcontentloaded",
      timeout: Math.min(timeoutMs * 0.4, 10000),
    }).catch(() => {
      // NTES SPA may not fire domcontentloaded cleanly — ignore.
    });

    const cookies = await context.cookies();
    console.log(`[ntesBrowser] Session cookies: ${cookies.map(c => c.name).join(", ") || "none"}`);

    // Step 2: Use window.fetch() INSIDE the browser to hit the API URL.
    // This is the key: page.evaluate() executes JavaScript in Chromium's V8,
    // using Chromium's own fetch/network stack — NOT Node's HTTP client.
    console.log(`[ntesBrowser] Calling API via in-browser fetch: ${apiUrl}`);

    const responseText = await page.evaluate(async (url) => {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json, text/plain, */*",
            "Cache-Control": "no-cache",
          },
          credentials: "include", // send the session cookies we just established
        });
        return await res.text();
      } catch (e) {
        return "__FETCH_ERROR__:" + e.message;
      }
    }, apiUrl);

    console.log(`[ntesBrowser] In-browser fetch result: ${String(responseText).slice(0, 150)}`);

    if (typeof responseText !== "string" || responseText.startsWith("__FETCH_ERROR__:")) {
      const errDetail = String(responseText).replace("__FETCH_ERROR__:", "");
      throw new Error(`In-browser fetch failed: ${errDetail}`);
    }

    if (!responseText.trim()) {
      throw new Error("NTES returned empty response via Playwright");
    }

    // Detect NTES maintenance page (redirects to /mntes with a JS snippet)
    if (
      responseText.includes("document.location") &&
      responseText.includes("mntes")
    ) {
      const msgMatch = responseText.match(/var\s+msg\s*=\s*"([^"]+)"/);
      const userMsg = msgMatch
        ? msgMatch[1].replace(/<[^>]+>/g, "").trim()
        : "NTES is currently under maintenance";
      throw new Error(`NTES maintenance: ${userMsg}`);
    }

    let json;
    try {
      json = JSON.parse(stripJsWrapper(responseText));
    } catch {
      throw new Error(
        `NTES response not valid JSON. Raw (first 400 chars): ${responseText.slice(0, 400)}`
      );
    }

    return json;
  } finally {
    await context.close().catch(() => {});
  }
}
