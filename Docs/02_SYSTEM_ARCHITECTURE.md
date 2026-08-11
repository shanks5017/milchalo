# RouteStitch — System Architecture

## 1. High-Level Shape

Two independently-deployable backend services behind one orchestrator, feeding one Node/Express core API that the existing React frontend already consumes.

```
                         ┌─────────────────────┐
                         │   React Frontend     │  (already built)
                         └──────────┬───────────┘
                                    │ REST/JSON
                         ┌──────────▼───────────┐
                         │   core-api (Node)     │
                         │  Express + Zustand    │
                         │                       │
                         │  routes/search.js  ───┼──► orchestrates below
                         │  algorithms/          │
                         │    graphBuilder.js     │
                         │    interchangeFinder.js│
                         │    stitchEngine.js      │
                         │    delayModel.js         │
                         │  train/ (folded in,       │
                         │    same language)          │
                         └──────┬──────────┬───────────┘
                                │          │
                     internal HTTP    internal HTTP
                                │          │
                    ┌───────────▼──┐   ┌───▼─────────────┐
                    │ bus-service   │   │ Supabase          │
                    │ (Python/      │   │ (PostgreSQL)        │
                    │ FastAPI,      │   │ - locations           │
                    │ Playwright/   │   │ - delay_history          │
                    │ Selenium)     │   │ - computed_routes          │
                    └───────────────┘   │ - train_journey_history      │
                                          │ - live_bus_snapshot (cache)   │
                                          │ - users / bookings              │
                                          └──────────────────────────────────┘
```

## 2. Why Two Languages, Deliberately (not by accident)

Decision, recorded so it isn't re-litigated: the train pipeline (RailKit + NTES/erail fallback via Playwright) is Node-native and stays in `core-api`. The bus scraper started as a working Python/Selenium project; rewriting it in JS purely for language purity is not worth the time at this stage. It is kept as a **separate service with a clean HTTP contract** (`POST /scrape {from, to, date} → JSON`), not merged into the Node codebase. This is a standard polyglot-microservice pattern, not a shortcut — see `06_ERROR_HANDLING_AND_RESILIENCE.md` for how failures are isolated between the two.

## 3. Process Supervision ("self-healing")

A single `orchestrator.js` (Node, `child_process.spawn`) is the entry point for local dev and for the container that gets deployed:

- Spawns `bus-service` (Python) as a subprocess.
- Runs `core-api` in-process or as a sibling subprocess.
- Health-checks both every N seconds via their `/health` endpoints.
- Restarts a subprocess that has crashed or stopped responding.
- Logs every restart with a reason and timestamp — recurring restarts are a signal (e.g. memory leak in Selenium not closing browser handles), not just noise.

**Scope of "self-healing":** this recovers from crashes and hangs. It does **not** fix broken scraper selectors or a logic bug — those require a code fix. Do not oversell this distinction, including in any pitch material.

## 4. Shared Browser Pool (critical resource-safety rule)

Both the train live-tracking path (Playwright/Chromium for NTES) and the bus scraper (Selenium/Chromium) launch headless browsers. Running these independently risks memory exhaustion under concurrent load.

Rule: **one shared browser instance per process, reused across requests via new pages/tabs, not a new browser launch per request.** Add a small concurrency queue (e.g. `p-queue` in Node, or a semaphore in Python) capping simultaneous scrape operations to 1–2. This is enforced in `services/browserPool.js` (Node side) and equivalently in the Python service.

## 5. Deployment — Corrected Finding (read before deploying)

Original plan assumed Railway as a free deployment target. **As of mid-2026, Railway has no meaningful free tier for a persistent multi-service app**: the ongoing "Free" plan is capped at 0.5 GB RAM / 1 vCPU / 1 project, which is not enough headroom to run headless Chromium reliably (Chromium alone commonly needs 200–400MB+ per instance). The 30-day $5 trial credit is temporary. Realistic minimum is the **Hobby plan (~$5/month)** once you're past the trial.

Action item: before deploying, decide between (a) paying the ~$5/month Railway Hobby cost, which is trivial and likely fine for a project-stage app, or (b) evaluating Render/Fly.io free tiers specifically for RAM headroom if zero cost is a hard constraint. Do not assume free-tier Railway will run the Playwright-based services without testing actual memory usage first.

## 6. Data Flow for a Search Request

1. Frontend → `POST /api/search {from, to, date, preferredTransferCity?, bufferOverrideMinutes?}`
2. `search.js` → `graphBuilder.js` loads relevant subgraph from Supabase (cached where possible).
3. `interchangeFinder.js` computes valid candidate cities (see `03_ALGORITHM_DESIGN.md`).
4. `stitchEngine.js` runs pathfinding, calling:
   - `trainLiveService.js` → RailKit (primary) → NTES/Playwright fallback → static `delay_history` (last resort)
   - `busLiveService.js` → HTTP call to `bus-service` (Python) → falls back to static Supabase bus data on failure/timeout
5. `delayModel.js` computes buffer requirements per leg, tier-adjusted, and filters out itineraries with insufficient buffer.
6. Ranked results returned; each result tagged with data-freshness badges per leg (Live / Estimated).
7. Route Detail click → per-leg deep-link URLs generated (see `03_ALGORITHM_DESIGN.md`, §5).

## 7. Environment / Secrets

- `.env` per service, never committed. `.env.example` maintained for both `core-api` and `bus-service`.
- Supabase URL/anon key, RailKit API key, Groq API key (if/when LLM features are added) all loaded via environment, validated at startup (fail fast with a clear error, not a silent undefined).
