# RouteStitch — Product Requirements Document (PRD)

## 1. Problem Statement

Existing Indian travel platforms (RedBus, IRCTC, MakeMyTrip) solve single-mode search: "trains from A to B" or "buses from A to B." They return **nothing** when no direct train or bus exists — which is the *majority* of real journeys between tier-2/tier-3 cities in India. Travelers are left to manually guess an interchange city, check 2-3 apps separately, and self-calculate whether their connection is safe.

RouteStitch solves this by automatically computing multi-leg journeys (train+bus, bus+bus, bus+train, any combination) with realistic, tier-aware buffer times between legs.

## 2. Target User

A traveler in a tier-2/tier-3 Indian city making an inter-city trip with no direct transport option (or wanting to compare direct vs. faster/cheaper multi-leg alternatives).

## 3. Core User Journey

1. User enters origin, destination, travel date.
2. System checks for direct routes first (train or bus) — always shown if they exist, never suppressed in favor of a multi-leg suggestion.
3. In parallel, system computes geographically-valid interchange candidates and searches multi-leg combinations.
4. Results shown as 2–3 ranked itineraries (fastest / cheapest / most reliable), each with total time, cost, leg count, and mode icons.
5. User can override: pick their own interchange city, adjust buffer time manually.
6. Route Detail page: map + timeline + per-leg cost breakdown.
7. Each leg deep-links to the actual booking platform (RedBus, IRCTC, etc.) with pre-filled route/date — user completes booking on the source platform.
8. Alerts: if a leg's predicted/live delay threatens the connection, user is notified with an alternative.
9. Dashboard: logged-in users see past searches, saved routes.

## 4. Non-Negotiable Product Rules

- **No hallucinated interchanges.** A candidate interchange city must pass a geometric detour-factor test (see `03_ALGORITHM_DESIGN.md`). Never suggest Delhi/Mumbai as a stop between two South Indian cities. This is enforced by deterministic math, not by an LLM's judgment.
- **Direct routes are never hidden.** If CBE→BGM has a direct bus, it appears even if a "faster" 2-leg option also exists.
- **Buffer time defaults scale with transfer-city tier**, and are always user-overridable.
- **Minimal interchanges preferred.** Ranking penalizes extra legs; 3-leg routes only surface when they meaningfully beat 2-leg or no 2-leg path exists.
- **Mode-agnostic scoring.** Train and bus legs are scored on the same axes (time, cost, class/reliability) so any combination can win on merit — no hardcoded mode preference.
- **Honesty about data freshness.** Train legs sourced from live tracking show a "Live" badge; bus legs sourced from static/historical data show an "Estimated" badge. Never present estimated data as live.

## 5. Feature Scope (MVP vs. Later)

| Feature | Phase |
|---|---|
| Direct route search (train + bus) | MVP |
| Multi-leg stitch engine with interchange finder | MVP |
| Tier-based buffer defaults + user override | MVP |
| Manual interchange city override | MVP |
| Map + timeline route detail | MVP (frontend already built) |
| Deep-link to booking platforms | MVP |
| Live train tracking/delay (RailKit or NTES fallback) | MVP |
| Bus live/near-live data (scraper) | MVP, degrade gracefully to static data |
| Delay alerts + reroute suggestion | Phase 2 |
| "Book all" unified checkout | Later (requires real partner APIs) |
| Exact train number / bus operator+service booking links | Add-on, Phase 2 |
| LLM-assisted NL summaries / fuzzy city input | Phase 2 (see `07_LLM_INTEGRATION.md`) |
| Real partner APIs (RedBus, IRCTC official) | Post-funding |

## 6. Success Criteria for "Done" (Prototype Stage)

A user can search a real no-direct-route pair (e.g. Coimbatore → Belagavi), get back a geographically sane, correctly-buffered multi-leg itinerary sourced from real data (not mocked), see it on a map, and click through to a real booking page for each leg — deployed and reachable via a public URL, not running only on localhost.

## 7. Explicit Framing for This Stage

This is being built as a **college project that must read as an industry-grade prototype**, not a toy demo. That means: real error handling, real data pipelines, defensible architecture decisions — while openly using free-tier/scraped data sources as placeholders for the licensed partner APIs that will be purchased once the project has funding. Every "temporary" data source (scrapers, free-tier LLMs) should sit behind a clean internal interface so it can be swapped for a paid/official source without touching the rest of the system.
