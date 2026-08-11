# RouteStitch — Algorithm Design

All logic in this document is **deterministic math on real coordinate/graph data**. No LLM sits in this decision path — see `07_LLM_INTEGRATION.md` for why that's a deliberate choice, not an omission.

## 1. Graph Model

- **Nodes**: cities/stations, each tagged with `lat`, `lon`, `city_tier` (1/2/3), `state`.
- **Edges**: individual scheduled services (one train run, one bus service), each with `mode`, `departure_time`, `arrival_time`, `operator`, `fare`, `seat_class`, `duration`.
- Built fresh per relevant subgraph on search (not a giant precomputed graph in memory) — `graphBuilder.js` pulls only nodes/edges relevant to the search's rough geographic bounding region.

## 2. Direct Route Check (Step 1, always runs first)

Query the graph for any direct edge origin→destination, any mode. If found, **always included** in results regardless of what multi-leg search finds. This satisfies the "never hide direct options" product rule.

## 3. Interchange Candidate Filtering — the hallucination-proofing step

This is the answer to "why isn't it suggesting Delhi for a Coimbatore→Belagavi trip."

**Detour-factor geometry test**, using only `lat`/`lon` already in the `locations` table:

```
For candidate city X to qualify as an interchange between origin O and destination D:

  distance(O, X) + distance(X, D)  ≤  distance(O, D) × DETOUR_FACTOR

where DETOUR_FACTOR ≈ 1.3–1.5 (tunable constant)
```

This guarantees X lies roughly *on the path* between O and D. Bangalore/Mysore pass this test for Coimbatore→Belagavi; Delhi/Mumbai fail by a huge margin and are excluded **before** any pathfinding runs — there is no code path by which they could appear in results.

**Second filter (v2, once shapefile data is loaded — `INDIAN-SHAPEFILES` repo):** administrative-adjacency check — candidate should sit in origin's state, destination's state, or a state directly between them. This catches edge cases where straight-line distance is misleading (river/coastline/hill-range geography). Implemented as a point-in-polygon test against the state boundary GeoJSON.

## 4. Candidate Ranking (Step 3)

Among cities that pass the geometry filter, rank by **edge count** in the graph (how many train+bus services originate/terminate there). This is what correctly prefers a real transport hub (Bangalore) over a geographically-valid but transport-poor small town, without any hardcoded city list.

## 5. Multi-Hop Pathfinding — `stitchEngine.js`

Modified time-windowed Dijkstra, restricted to the filtered candidate set from Step 3–4 (keeps search space small — not all 1,163 cities, only the geographically sane ones).

```
Pseudocode:

function stitchRoute(origin, destination, date, options):
    directRoutes = findDirectEdges(origin, destination, date)

    candidates = filterByDetourFactor(origin, destination, allCities, DETOUR_FACTOR)
    candidates = rankByConnectivity(candidates)
    candidates = options.preferredTransferCity
                    ? [options.preferredTransferCity]
                    : candidates.slice(0, TOP_N)   // cap search space

    graph = buildSubgraph(origin, destination, candidates, date)

    paths = timeWindowedDijkstra(
        graph,
        source = origin,
        target = destination,
        maxLegs = 3,                     // minimal-interchange preference
        bufferFn = (arrivalCity, arrivalTime) =>
            options.bufferOverrideMinutes
                ?? tierBasedDefaultBuffer(arrivalCity.tier),
        edgeScoreFn = (edge) => weightedScore(edge.time, edge.cost, edge.classPref)
    )

    allResults = directRoutes.concat(paths)
    return rankAndReturn(allResults, topN = 3)
```

- **Edge validity**: a connecting edge is only traversable if `nextDeparture ≥ prevArrival + buffer`. This is where tier-based buffers plug in directly.
- **Mode-agnostic**: `edgeScoreFn` treats a train edge and a bus edge identically — same scoring inputs. This is what allows any train/bus combination to surface purely on merit, not by special-casing.
- **Leg cap**: `maxLegs = 3` by default, enforcing the "minimal interchange" product rule; a 3rd leg only appears in results if it beats the best 2-leg (or direct) option after scoring.

## 6. Tier-Based Buffer Defaults — `delayModel.js`

```
function tierBasedDefaultBuffer(cityTier):
    switch cityTier:
        case 1: return 45   // minutes — more traffic/platform chaos
        case 2: return 30
        case 3: return 20
    // Always overridable per-leg by options.bufferOverrideMinutes
```

Delay data sourcing priority per mode:
1. **Train**: RailKit live delay data (preferred) → NTES via Playwright fallback → static historical average from `delay_history` (last resort, tagged "Estimated").
2. **Bus**: static historical average from `delay_history` currently (no reliable live source exists yet); `live_bus_snapshot` cache used opportunistically when the bus scraper has recent data for that route.

`null` vs `0` distinction is preserved end-to-end (established in the train module build): `null` = data unavailable → fall back to next source; `0` = confirmed on-time. Never conflate the two.

## 7. Final Ranking (Step 6)

Weighted score across:
- Total journey time
- Total cost
- Seat-class preference (SL/3AC biased up for trains; cheapest reasonable option biased up for buses)
- Reliability confidence (inverse of delay variance/buffer size — tighter, more confident buffers rank higher)

Top 2–3 distinct itineraries returned, not a single "best" answer — e.g. fastest / cheapest / most reliable, deduplicated if two categories converge on the same route.

## 8. Route Detail — Deep-Link Generation

For each leg, generate a pre-filled search URL to the source platform rather than scraping booking into RouteStitch's own UI (see PRD §4, and the scraping-risk discussion in project history):

```
Train leg  → IRCTC/RailKit search deep-link with train number, date, class pre-filled
Bus leg    → RedBus/AbhiBus search results URL with from/to/date query params pre-filled
```

User leaves RouteStitch to complete booking on the source platform — this is both the least legally risky pattern and matches the original "affiliate deep-link" product brief.
