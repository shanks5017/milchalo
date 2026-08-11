# RouteStitch — Pre-Build Planning Documents

Prepared before Phase 2A implementation, per "prepare the ingredients before cooking" — these are the binding reference documents for all future antigravity prompts and architecture decisions.

| Doc | Purpose |
|---|---|
| `01_PRD.md` | What we're building, for whom, and the non-negotiable product rules (no hallucinated interchanges, direct routes never hidden, tier-based buffers, mode-agnostic scoring) |
| `02_SYSTEM_ARCHITECTURE.md` | Service topology, why two languages, process supervision, shared browser pool, **corrected Railway deployment finding** |
| `03_ALGORITHM_DESIGN.md` | The actual stitch engine: graph model, detour-factor interchange filtering, pathfinding pseudocode, buffer math, deep-link generation |
| `04_DATA_PIPELINE.md` | Data inventory, cleaning standards (derived from real bugs found/fixed), import pipeline, live-data caching, self-building historical dataset |
| `05_TECH_STACK_AND_COSTS.md` | Every tech decision with rationale, **verified free-tier facts** for Groq/Railway/RailKit as of July 2026 |
| `06_ERROR_HANDLING_AND_RESILIENCE.md` | Binding standards: response shape contract, fallback chains, timeouts, resource-safety rules, scope boundary of "self-healing" |
| `07_LLM_INTEGRATION.md` | Where Groq is and isn't used, and why — governing principle: deterministic math stays algorithmic, only genuinely linguistic tasks get an LLM |

## Two Findings From Research That Change the Existing Plan

1. **Railway has no workable perpetual free tier in 2026** (0.5GB RAM free plan can't reliably run headless Chromium). Budget ~$5/month (Hobby plan) or evaluate Render/Fly.io free tiers before deploying. Full detail: `02_SYSTEM_ARCHITECTURE.md` §5, `05_TECH_STACK_AND_COSTS.md` §7.
2. **Groq's free tier is real and usable but per-minute-token-limited, not per-key**, and should be scoped to specific, low-frequency, genuinely-linguistic tasks (fuzzy city matching, route summaries, import-time text parsing) — not put in the hot path of every search. Full detail: `07_LLM_INTEGRATION.md`.

## Suggested Build Order From Here

1. `interchangeFinder.js` (smallest, self-contained, everything else depends on its output)
2. `graphBuilder.js` + `stitchEngine.js` (dummy data first, per original VibeCoding instruction — prove pathfinding logic before wiring live data)
3. Wire in `trainLiveService.js` (RailKit primary) and `busLiveService.js` (call to Python bus-service) behind the fallback chains defined in `06_ERROR_HANDLING_AND_RESILIENCE.md`
4. `orchestrator.js` for process supervision, once both services exist to supervise
5. Deploy to Railway (post-decision on §7 of tech stack doc), test actual memory usage under load before considering it stable
