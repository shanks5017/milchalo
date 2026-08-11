# RouteStitch — Data Pipeline & Preparation

## 1. Current Data Inventory

| Source | Records | Status |
|---|---|---|
| Static train dataset | ~183K rows, 42 trains, 1,479 stations | Imported to Supabase |
| Static bus dataset (Pan-India routes) | 35,667 rows, 940 raw operator names → 732 normalized | Cleaned (v2), ready to import |
| GTFS-style city stop data (e.g. `hyd_stops.csv`) | Per-city stop-level lat/lon | Available, not yet imported |
| `INDIAN-SHAPEFILES` | State/district/metro boundary GeoJSON | Available, needed for interchange-finder v2 (§3 of `03_ALGORITHM_DESIGN.md`) |
| RailKit / NTES live train data | Live | Integrated, see `02_SYSTEM_ARCHITECTURE.md` |
| Bus scraper (Python/Selenium) | Live-ish, cached | Integrated as separate service |

## 2. Cleaning Standards Applied (bus dataset — precedent for all future imports)

Established through the actual v1→v2 cleanup cycle on `Pan-India_Bus_Routes.csv`:

1. **Never trust a raw duration/time field at face value.** Recompute from source timestamps (departure/arrival) rather than relying on a pre-populated duration column — the original had a malformed `H:M:S` field encoding bugs.
2. **Rows with missing/degenerate source data (e.g. `departure == arrival`) get flagged, not silently zeroed.** Use a `data_quality_flag` column (e.g. `"missing_arrival"`) and `null` the derived field, rather than letting bad data masquerade as a real `0`.
3. **Free-text categorical fields get parsed into structured tags at import time, not query time** — e.g. `"A/C, 2+2 Semi Sleeper, Hi-Tech"` → `is_ac`, `seat_layout`, `seat_config`, `has_amenities[]`. Watch for substring-matching bugs (e.g. "Non-Video" incorrectly exploding into both "Video" and "Non-Video" tags via naive keyword search) — verify amenity tags against the raw string, not just against the presence of keywords.
4. **Entity normalization (operator names, city names) needs verification, not just a script run.** A first-pass normalization is rarely sufficient (940→815 names on the first attempt, 940→732 after a fuzzy-matching pass) — spot-check specific known duplicates before accepting a cleaned file as final.
5. **Singleton/anomaly flags must be verified against ground truth**, not assumed correct because the script ran without error — count actual occurrences and diff against the flag column before trusting it.

## 3. Import Pipeline (Python, offline processing only — per project convention)

```
raw CSV
  → cleaning pass (pandas): duration recompute, entity normalization, tag parsing
  → validation pass: assert row counts, spot-check known duplicates/anomalies
  → mapping tables emitted separately (e.g. operator_name_mapping.csv) for human review
  → import script writes to Supabase via batched inserts
  → auto-trigger functions populate ML features (day_of_week, season, is_weekend) on insert
```

Python is strictly for this offline batch layer — the application/runtime layer stays JavaScript throughout, per existing project convention.

## 4. Live Data Caching Layer

To avoid live-scraping on every user search (both for RedBus-style scraping risk and NTES latency):

- `live_bus_snapshot` table: `route_key, scraped_at, payload_json`. Scheduled refresh job (n8n) pre-warms popular routes (derived from historical demand in the static dataset) on a schedule; on-demand scrape only triggered for a cache-miss route.
- Train live data cached in-memory (`node-cache`, 5–10 min TTL) per `trainNo + date` — already implemented in the train module.
- UI always shows a "data as of [time]" indicator when serving cached/estimated data — this is a product-honesty requirement (PRD §4), not just an engineering nicety.

## 5. Historical Delay Dataset — Self-Building Asset

`train_journey_history` (Supabase) grows automatically via `historyLogger.js` every time a tracked train completes its journey — this is a genuine data moat that improves over time without manual work, and is the long-term replacement for relying on any third-party's bulk history endpoint (which none of the free tiers expose anyway).

Equivalent for buses: as `live_bus_snapshot` accumulates over time, periodically fold expired snapshots into `delay_history` as additional historical samples rather than discarding them — turns the caching layer into a second data-collection pipeline for free.

## 6. Data Quality Gate Before Any Production Import

Before any cleaned file is imported to the production Supabase tables, run this checklist (derived directly from the real issues found in the bus dataset cleanup):

- [ ] No degenerate rows silently treated as valid (0 duration, identical from/to, etc.)
- [ ] Entity normalization spot-checked against at least 10 known duplicate cases
- [ ] Any derived flag column (singleton, anomaly, quality) verified by independent recount, not just trusted
- [ ] Structured tags parsed from free text spot-checked for substring/keyword collision bugs
- [ ] Row count before/after cleaning reconciled and explained (no silent drops)
