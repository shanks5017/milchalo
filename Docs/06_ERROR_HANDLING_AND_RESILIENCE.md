# RouteStitch — Error Handling & Resilience Standards

Written as binding standards for all future antigravity/code-generation prompts, not suggestions — derived from real bugs found and fixed during this project (hanging catch blocks, off-by-one date bugs, NTES protocol-level failures).

## 1. Response Shape Contract (applies to every internal service)

Every endpoint, in every service (Node or Python), returns one of exactly two shapes:

```json
// Success
{ "success": true, "data": { ... } }

// Failure
{ "success": false, "error": "human-readable reason", "source": "which upstream failed" }
```

No endpoint may hang without responding (the original bus/train repos both had this bug pre-fix). No endpoint may throw an unhandled exception to the client. `stitchEngine.js` and any caller must be able to branch on `success` without guessing.

## 2. Fallback Chain Discipline

Every live-data call has a defined, ordered fallback chain, and every step in the chain must have an explicit timeout:

**Train delay data:**
```
RailKit (timeout 5s)
   → NTES via Playwright (timeout ~30–45s, browser launch is slow)
      → static historical average from delay_history (always succeeds, tagged "Estimated")
```

**Bus delay data:**
```
live_bus_snapshot cache (fast, DB read)
   → on-demand scrape via bus-service (timeout ~20–30s)
      → static historical average from delay_history (always succeeds, tagged "Estimated")
```

Rule: **the static historical fallback must never itself be able to fail** for a route that exists in the dataset — it is the guaranteed floor. `stitchEngine.js` should never return a hard error to the user because a live source was unavailable; it degrades gracefully and marks data freshness accordingly (PRD §4).

## 3. The `null` vs `0` Rule (non-negotiable, already established in train module)

`delayMinutes: null` means "we don't know" → triggers fallback. `delayMinutes: 0` means "confirmed on time." These must never be conflated anywhere in the pipeline — a bug that treats missing data as zero delay silently corrupts every buffer calculation downstream.

## 4. Timeout Standards

| Call type | Timeout |
|---|---|
| Fast internal DB read (Supabase) | 3–5s |
| RailKit / external hosted API | 5–8s |
| Playwright/headless-browser-based scrape | 30–45s (browser launch + navigation is inherently slow) |
| Any outbound call inside `stitchEngine.js`'s critical path | Must not block the overall search response beyond a hard ceiling (e.g. 10s) — if live data isn't back by then, proceed with the static fallback and let live data update asynchronously if it arrives later |

## 5. Resource-Safety Rules (crash prevention, not just error handling)

- **Shared browser pool, concurrency-capped** (architecture doc §4) — the single highest-risk failure mode for this project is two heavy Playwright/Selenium scrapes running simultaneously and exhausting container memory.
- **Rate-limit self-discipline on every scraped upstream** — throttle outbound requests (e.g. 300ms+ between NTES calls, similar for bus scraping), rotate realistic headers, cache aggressively. This protects the *service itself* from being blocked, independent of any legal consideration.
- **Process supervision restarts crashed subprocesses** but logs every restart — recurring restarts on the same service within a short window is a signal to investigate (likely a memory leak, e.g. Selenium not closing browser instances), not something to just let the supervisor paper over indefinitely.

## 6. Data-Quality Error Handling (input side)

Applies to every import/cleaning script (see `04_DATA_PIPELINE.md` §2 for the concrete precedent):
- Never silently coerce bad/missing source data into a valid-looking default (e.g. a missing arrival time becoming `duration = 0`). Flag explicitly (`data_quality_flag`) and null the derived field.
- Any automated cleaning/normalization pass must be spot-checked against known cases before being trusted — a script completing without a Python exception is not the same as the output being correct (proven twice in this project: singleton-flag logic, amenity-tag parsing).

## 7. Frontend-Facing Error UX

- If `stitchEngine.js` returns zero valid itineraries (rare, but possible for very obscure city pairs), the UI must show a clear "no route found" state — never a blank screen or generic crash.
- If a leg's data is estimated rather than live, this is surfaced visually (badge/label), not hidden — consistent with the product's honesty requirement.
- Booking deep-links that fail to resolve (e.g. platform changed their URL structure) should degrade to a generic search page on that platform rather than a dead link.

## 8. What Self-Healing Does *Not* Cover (explicit scope boundary)

Documented once here so it doesn't need re-litigating: process supervision and fallback chains handle **crashes, hangs, and upstream unavailability**. They do not and cannot fix: a scraper selector broken by a frontend redesign on the target site, a genuine logic bug in the stitch algorithm, or bad source data. Those require a human code fix, surfaced via the restart-frequency logging in §5.
