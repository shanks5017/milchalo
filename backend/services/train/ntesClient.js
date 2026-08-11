/**
 * ntesClient.js
 * Thin, resilient wrapper around NTES enquiry endpoints.
 *
 * ## Why Node's built-in fetch fails against NTES
 * enquiry.indianrail.gov.in returns HTTP responses with bare LF line endings
 * ("HTTP/1.1 200 OK\n") instead of the required CR+LF ("HTTP/1.1 200 OK\r\n").
 * Node.js's built-in fetch (undici) and even the legacy node:https module both
 * enforce RFC 2616 strictly and throw:
 *   "Parse Error: Missing expected CR after response line"
 * Headers/cookies/session bootstrapping cannot fix this — it is a server-side
 * HTTP compliance bug at the byte level.
 *
 * ## Solution
 * Use the Playwright Chromium fallback (ntesBrowser.js). Chromium's TLS+HTTP
 * stack is lenient about line endings, as all real browsers are. We intercept
 * the XHR response at the network layer before it hits JavaScript — this gives
 * us the raw JSON without any DOM scraping.
 *
 * ## Fallback chain
 *  1. Try native fetch (fast, <1 s) — will fail against NTES but is kept for
 *     forward compatibility in case NTES fixes their server
 *  2. Fall back to Playwright (adds ~1–2 s per cold call, reuses browser after)
 *
 * getTrains.js (erail.in routes) is unaffected — erail.in is HTTP/1.1 compliant.
 */

import { fetchNtesBrowser } from "./ntesBrowser.js";

export class NtesError extends Error {
  constructor(message, { cause, statusCode } = {}) {
    super(message);
    this.name = "NtesError";
    this.cause = cause ?? null;
    this.statusCode = statusCode ?? null;
  }
}

// ── Throttle queue ──────────────────────────────────────────────────────────

const INTER_REQUEST_DELAY_MS = 500; // slightly more generous with Playwright

let requestQueue = Promise.resolve();

function enqueue(fn) {
  requestQueue = requestQueue
    .then(() => new Promise((resolve) => setTimeout(resolve, INTER_REQUEST_DELAY_MS)))
    .then(fn);
  return requestQueue;
}

// ── NTES request headers (kept for the native-fetch fast path) ──────────────

const NTES_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8,hi;q=0.7",
  "Referer": "https://enquiry.indianrail.gov.in/ntes/NTES",
  "Origin": "https://enquiry.indianrail.gov.in",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

// ── JS-wrapper stripper ─────────────────────────────────────────────────────

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

// ── Native fetch (fast path, will fail vs NTES today) ──────────────────────

async function _doNativeFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: NTES_HEADERS,
      signal: controller.signal,
    });
    if (!response.ok) throw new NtesError(`NTES HTTP ${response.status}`, { statusCode: response.status });
    const text = await response.text();
    if (!text?.trim()) throw new NtesError("NTES returned empty response");
    return JSON.parse(stripJsWrapper(text));
  } catch (err) {
    if (err instanceof NtesError) throw err;
    if (err.name === "AbortError") throw new NtesError(`NTES timeout after ${timeoutMs}ms`, { cause: err });
    throw new NtesError(`NTES native fetch error: ${err.message}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }
}

// ── Playwright fallback ─────────────────────────────────────────────────────

async function _doPlaywrightFetch(url, timeoutMs) {
  try {
    const json = await fetchNtesBrowser(url, timeoutMs);
    if (json._raw !== undefined) {
      // ntesBrowser couldn't parse the body — surface it as an error
      throw new NtesError(
        `NTES Playwright fallback: response not valid JSON. Raw: ${String(json._raw).slice(0, 200)}`
      );
    }
    return json;
  } catch (err) {
    if (err instanceof NtesError) throw err;
    throw new NtesError(`NTES Playwright error: ${err.message}`, { cause: err });
  }
}

// ── Public entry point ──────────────────────────────────────────────────────

/**
 * Fetch NTES API URL. Tries native fetch first; falls back to Playwright
 * if the native attempt fails with the known CR/LF parse error.
 *
 * @param {string} url
 * @param {number} [timeoutMs=15000]
 * @returns {Promise<object>}
 * @throws {NtesError}
 */
export function fetchNtes(url, timeoutMs = 15000) {
  return enqueue(async () => {
    // Fast path: try native fetch
    try {
      const result = await _doNativeFetch(url, Math.min(timeoutMs, 5000));
      console.log("[ntesClient] Native fetch succeeded");
      return result;
    } catch (nativeErr) {
      // enquiry.indianrail.gov.in returns bare-LF HTTP/1.1 responses which
      // Node's HTTP parser rejects. The top-level message is "fetch failed"
      // and the CR detail may be nested anywhere in the cause chain.
      // Rather than try to inspect cause chains (fragile across Node versions),
      // we fall through to Playwright for ANY native-fetch failure against NTES,
      // including timeouts (as Node fetch may timeout due to WAF blocking or TLS hangs).

      console.log(`[ntesClient] Native fetch failed (${nativeErr.message}) — falling back to Playwright`);
    }

    // Playwright fallback
    return _doPlaywrightFetch(url, timeoutMs);
  });
}

// ── URL builders ─────────────────────────────────────────────────────────────

const NTES_BASE = "https://enquiry.indianrail.gov.in/ntes/NTES";

export function trainDataUrl(trainNo, date) {
  const params = new URLSearchParams({ action: "getTrainData", trainNo });
  if (date) params.set("date", date);
  return `${NTES_BASE}?${params}`;
}

export function stationBoardUrl(stationCode) {
  const params = new URLSearchParams({
    action: "getStationData",
    stationCode: stationCode.toUpperCase(),
  });
  return `${NTES_BASE}?${params}`;
}
