# RouteStitch — Tech Stack & Free-Tier Reality Check

Researched live as of July 2026. Numbers here are cited to verify before final commitment — free-tier terms change without much notice.

## 1. Frontend (unchanged, already decided)

React + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion + Leaflet.js + Zustand. Deployed to Vercel (genuinely free for this workload).

## 2. Backend

| Component | Choice | Notes |
|---|---|---|
| Core API | Node.js + Express | Confirmed working (train module) |
| Bus scraping service | Python + FastAPI wrapping existing Selenium logic | See `02_SYSTEM_ARCHITECTURE.md` §2 for why not rewritten in JS |
| Process supervision | Custom `orchestrator.js` (Node `child_process`) | Crash-recovery, not bug-immunity — see `06_ERROR_HANDLING_AND_RESILIENCE.md` |
| Browser automation | Playwright (train/NTES), Selenium (bus, existing) | Shared browser-pool pattern mandatory (see architecture doc §4) |

## 3. Database

Supabase (PostgreSQL) — already in use, real operational data, free tier has historically been generous for project-scale usage. **Action item:** verify current Supabase free-tier row/bandwidth limits directly in the Supabase dashboard before scaling data import, as these change over time.

## 4. Train Live Data — Decision Record

| Option | Verdict |
|---|---|
| RailKit (hosted SDK) | **Primary choice.** Free tier confirmed to exist with paid tiers starting ~₹49/month for higher limits. Handles IRCTC/NTES anti-bot measures so you don't have to. |
| Self-hosted NTES scraper (Playwright) | **Built as fallback**, not primary. Root cause found: NTES sends HTTP/1.1-non-compliant responses (missing CR in status line); only a real browser's lenient parser (via `page.evaluate(() => fetch())`) works around it. Real, working, but heavier (headless Chromium per call) and fragile to NTES-side changes/maintenance windows. |
| erail.in wrapper | **Confirmed reliable** for static schedule/route data — keep as-is. |

## 5. Bus Data — Decision Record

No RailKit-equivalent exists for Indian intercity buses. Two real options evaluated:

- **Official partner APIs (RedBus/AbhiBus)**: require a formal B2B agreement, 3–5 week integration, not accessible pre-revenue. **Deferred to post-funding**, per PRD framing.
- **Self-built scraper**: chosen for now, isolated as its own service with caching + rate-limiting discipline (see `06_ERROR_HANDLING_AND_RESILIENCE.md`). Explicitly a placeholder swapped for a partner API once funded — kept behind a clean `busLiveService.js` interface for exactly this reason.

## 6. LLM Layer — Groq

Confirmed free-tier facts (verified July 2026, subject to change without notice — check `console.groq.com` before relying on exact numbers):

- No credit card required for the free tier.
- Rate limits apply **per organization**, not per API key — creating extra keys does not multiply capacity.
- Typical free-tier caps: ~30 requests/minute, low-thousands tokens/minute (varies by model), ~1,000–14,400 requests/day depending on model — the **per-minute token limit is usually the real bottleneck**, not the daily cap.
- OpenAI-SDK-compatible endpoint (`https://api.groq.com/openai/v1`) — trivial to integrate if already using an OpenAI-style client.
- Adding a card (still $0 minimum spend) unlocks the "Developer" tier at ~10x the limits plus a token-cost discount, for when free-tier limits start blocking real usage.

See `07_LLM_INTEGRATION.md` for exactly where Groq is (and isn't) used, and why.

## 7. Deployment — Corrected Finding (important, re-stated from architecture doc)

**Railway no longer has a workable perpetual free tier as of 2026.** The $5 trial is one-time/30-day; the ongoing "Free" plan (0.5GB RAM/1 vCPU/1 project) is too small to reliably run headless-Chromium-based services. Realistic cost: **Hobby plan, ~$5/month minimum**, usage-billed on top only if you exceed that included credit.

Decision needed from you: pay the ~$5/month (recommended — trivial cost, keeps Railway's genuinely good DX), or evaluate Render/Fly.io free tiers specifically for RAM headroom before committing. Do not deploy assuming free Railway will work without checking actual memory usage of the Playwright/Selenium services first.

## 8. Automation / Orchestration

n8n — already in your toolkit, used for: scheduled cache-warming of popular bus routes, delay-monitoring triggers, any future rerouting-alert workflows. No change from original plan.

## 9. What's Explicitly Out of Scope for MVP (cost discipline)

- Paid RedBus/AbhiBus/IRCTC partner APIs — post-funding only.
- Any LLM provider beyond Groq's free tier for MVP — no OpenAI/Anthropic API spend until there's a specific capability Groq's free tier can't cover.
- Managed Redis/queue infrastructure — in-memory caching (`node-cache`) is sufficient at this scale; revisit only if deployed to multiple instances.
