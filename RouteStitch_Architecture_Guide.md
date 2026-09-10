# RouteStitch v1.1 - Comprehensive Technical Architecture & Engineering Guide

> **Authoritative Technical Documentation**
> *Status: Active / Production Ready*
> *Project Name: RouteStitch Precision Multi-Modal Transit Engine*
> *Version: 1.1*

---

## 1. Executive Summary & System Overview

RouteStitch is an advanced, multi-modal transit interlining engine designed to solve the complex problem of point-to-point travel across disparate transit networks (primarily Indian Railways and inter-city bus networks). Unlike standard aggregators that only show direct routes for a single mode of transport, RouteStitch programmatically discovers, validates, and ranks "stitched" itineraries—journeys combining multiple legs (e.g., Train → Bus, Train → Train) through dynamically calculated geographic interchanges.

The core engineering philosophy of RouteStitch is **Deterministic Mathematics over AI Guesswork**. While AI and LLMs are excellent for parsing unstructured data or generating UI, they are inherently probabilistic and prone to hallucinating non-existent transit connections (e.g., suggesting a layover in Delhi for a trip between two southern cities). RouteStitch solves this by employing strict, mathematically sound geographic gating mechanisms, real-time web scraping, and deterministic time-windowed pathfinding algorithms. 

This document serves as the absolute technical source of truth for the project, detailing the complete lifecycle of a search request, the intricate data pipelines, algorithmic design patterns, frontend rendering logic, and the tech stack holding it all together.

---

## 2. Technology Stack & Architecture

RouteStitch follows a decoupled, client-server architecture with heavy emphasis on parallel, real-time data ingestion. 

### 2.1 Backend (Core API & Engine)
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js (v5.2.1)
- **Language:** JavaScript (ES6 Modules)
- **Scraping Engine:** Playwright (v1.61) & Cheerio (v1.2.0) for headless browser automation and DOM parsing.
- **Concurrency & Rate Limiting:** `p-queue` for managing parallel scraping tasks without hitting source IP bans.
- **HTTP Client:** `got` and `axios` for standard REST calls.
- **Caching:** `node-cache` for ephemeral, in-memory caching of static station data and recent searches.
- **Database / Data Store:** Currently, no traditional RDBMS is in the hot path. The system relies on static JSON registries (`cityRegistry.json`, `unifiedLocations.json`) derived from Indian Shapefiles, and real-time scraped data. Supabase is included in dependencies for future persistence (user profiles, search history).

### 2.2 Frontend (Client Application)
- **Build Tool:** Vite (v6) for rapid HMR and optimized bundling.
- **Framework:** Vanilla JavaScript + HTML/CSS for the core search interface, with React dependencies staged for an upcoming architectural migration (`react-example`).
- **Styling:** Vanilla CSS (`index.css`) with heavy use of CSS Variables (Custom Properties) for theming, flexbox/grid for layouts, and keyframe animations for loading states (pulsing skeletons). TailwindCSS is available via Vite plugins.
- **Icons:** FontAwesome (injected via CDN/assets) and Lucide React (staged).

### 2.3 Data Sources & Integrations
- **Trains:** `erail.in` (scraped via headless Playwright / raw HTTP fetches) and NTES (National Train Enquiry System) for live tracking.
- **Buses:** RedBus / AbhiBus / custom scraper endpoints.
- **Geographic Data:** Indian District Headquarters Shapefiles (GeoJSON) used to generate the static `cityRegistry.json`.

---

## 3. The Lifecycle of a Search Request

When a user initiates a search from the frontend, a highly orchestrated sequence of events occurs. Here is the step-by-step technical breakdown:

### Phase 1: Client-Side Preparation & Validation
1. **Input Resolution:** The user types in the `from` and `to` fields. The frontend uses a local in-memory array (`allLocations`) fetched from `/api/locations` to provide real-time autocomplete.
2. **Code Extraction:** The frontend extracts the exact 2-5 letter station/city code (e.g., `SBC` for Bangalore).
3. **Payload Construction:** A JSON payload is constructed containing `mode` (stitched/train/bus), `from`, `to`, `departureDate`, `maxBufferMinutes`, and a unique `sessionId`.
4. **SSE Connection Initialization:** The client opens a Server-Sent Events (SSE) connection to `/api/search/logs/:sessionId` to stream real-time execution logs back to the UI (the "console feedback" feature).
5. **API Invocation:** An HTTP POST request is fired to `/api/search`.

### Phase 2: Engine Orchestration (`app.js` -> `routes/search.js` -> `stitchEngine.js`)
1. The Express router receives the payload and passes it to `stitchEngine.stitchRoute()`.
2. The engine evaluates the `mode` parameter. If `mode === 'train'` or `'bus'`, `maxLegs` is forced to 1. If `'stitched'`, `maxLegs` is set to 3.

### Phase 3: Hallucination Prevention & Geographic Gating (`interchangeFinder.js`)
*This is the most critical algorithmic step in the system.*
Before asking the scraper to find trains between two cities, the engine must decide *which* cities are valid layover points. 
1. **Coordinate Lookup:** Origin and Destination codes are converted to exact Lat/Lon coordinates via `unifiedLocations.json`.
2. **Haversine Distance Calculation:** The exact straight-line distance between Origin (O) and Destination (D) is calculated using the Haversine formula.
3. **Detour Factor Gate:** The engine iterates over 1,224 Indian District Headquarters (`cityRegistry.json`). For each candidate city (X), it calculates:
   `Distance(O, X) + Distance(X, D)`
   If this sum is greater than `Distance(O, D) * DETOUR_FACTOR` (usually 1.4 or 2.0 for stitched), the city is mathematically rejected. This completely eliminates geographic hallucinations.
4. **Scoring & Ranking Candidates:** Valid cities are ranked based on their connectivity. "Major Hubs" (like Bangalore, Chennai, Delhi) receive a massive score boost. Ties are broken by proximity to the exact midline between Origin and Destination.
5. **Selection:** The top 2-3 candidates are returned to the engine.

### Phase 4: Subgraph Building & Parallel Scraping (`graphBuilder.js`)
1. With the Origin, Destination, and Interchange Candidates known, the engine builds a targeted sub-graph.
2. The engine fans out asynchronous scraping tasks in parallel. For example, if the Origin is `CBE`, Destination is `BGM`, and candidate is `SBC`:
   - Task A: Scrape direct trains/buses CBE -> BGM.
   - Task B: Scrape trains/buses CBE -> SBC (Leg 1).
   - Task C: Scrape trains/buses SBC -> BGM (Leg 2).
3. These tasks utilize the scraper modules (`eRailText.js`, `scrapeErailJs.cjs`) which manage Playwright instances, parse the messy DOM of source sites, and return structured JSON arrays of available services.

### Phase 5: Normalization & Time-Windowed Leg Matching
1. **Normalization:** Raw scraper outputs are passed through `normalizeTrain()` and `normalizeBus()` inside `stitchEngine.js`. This converts strings to absolute minutes from midnight, standardizes fare strings to integers, and calculates exact arrival dates (handling overnight journeys).
2. **Buffer Calculation:** For every potential connection, `tierBasedDefaultBuffer()` is called. This function calculates the minimum safe layover time based on the transit mode and the interchange city's tier (e.g., Tier 1 cities require 45 mins buffer due to platform changes and traffic; Tier 3 require 20 mins).
3. **Leg Matching:** The engine loops through all Leg 1 services. For each, it filters Leg 2 services where `Leg 2 Departure >= Leg 1 Arrival + Calculated Buffer`.
4. **Slack Constraints:** Connections with excessive layovers (e.g., waiting 14 hours at a station) are rejected based on `maxBufferMins`.

### Phase 6: Multi-Axis Scoring & Ranking
Valid stitched itineraries are passed to `scoreItinerary()`.
1. The engine calculates the theoretical min and max values for Duration and Cost across all valid routes.
2. Each route receives a normalized score (0.0 to 1.0) on three axes:
   - **Fastest:** Inverse of total duration.
   - **Cheapest:** Inverse of total cost.
   - **Reliable:** Based on the "slack" (extra buffer time). More slack = higher reliability score (capped at 3x the required buffer).
3. A `compositeScore` is calculated as the unweighted average of the three axes.
4. To ensure diversity, a maximum of 25 routes per transit hub are selected, and duplicate routes (same trains, different minor hubs) are fingerprinted and removed.
5. Each route is tagged with a `rankLabel` (fastest, cheapest, or reliable) to power UI badges.

### Phase 7: Response Formatting & Deep Linking
1. The engine maps the internal leg objects to the final API response schema.
2. Crucially, the engine does *not* attempt to handle ticketing. Instead, it generates Affiliate Deep Links (`trainDeepLink()`, `busDeepLink()`). For trains, it crafts an exact URL to `erail.in` or IRCTC pre-filled with the Train No, Date, and Source/Dest codes.
3. The response is sent back to the client as JSON.

---

## 4. Deep Dive: Geographic Algorithms & Hallucination Prevention

### 4.1 The Problem with LLMs in Transit
Initial naive implementations of transit routing often attempt to use LLMs (like GPT-4) to say "Find me a route from A to B". LLMs fail at this because they lack an internal spatial grid; they rely on semantic association. An LLM might suggest a layover in Mumbai for a trip from Pune to Nagpur simply because Mumbai is semantically strongly associated with Maharashtra transport, even though it requires travelling in the exact opposite direction.

### 4.2 The Geometric Detour Gate
RouteStitch solves this purely mathematically in `backend/algorithms/interchangeFinder.js`.

```javascript
// Haversine Distance Formula (simplified)
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// The core gate:
export function isWithinDetourFactor(origin, candidate, destination, maxFactor) {
  const direct = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const via = haversineKm(origin.lat, origin.lon, candidate.lat, candidate.lon) +
              haversineKm(candidate.lat, candidate.lon, destination.lat, destination.lon);
  return (via / direct) <= maxFactor;
}
```

By setting `maxFactor` to `1.4` (for strict routes) or `2.0` (for exploratory stitched routes), the search space is instantly reduced from ~4000 Indian cities down to the 5-15 cities that geographically make sense. 

### 4.3 Node Graph Generation
Instead of maintaining a massive graph of every train in India (which changes daily due to delays and cancellations), RouteStitch generates an **Ephemeral Directed Acyclic Graph (DAG)** on the fly. Nodes are the cities (Origin, Validated Interchanges, Destination). Edges are the actual, live-scraped services returned by the APIs. This guarantees that if a train is cancelled today, it simply never becomes an edge in the graph, preventing dead routes.

---

## 5. Deep Dive: Delay Modeling & Buffering

Connecting two disparate transit systems (e.g., Indian Railways and a private sleeper bus) is risky. A 5-minute delay on the first leg can cause the user to miss the second leg entirely. RouteStitch handles this in `backend/algorithms/delayModel.js`.

### 5.1 Tier-Based Safe Buffers
Cities are classified by tier (metadata attached to `cityRegistry.json`). 
- **Tier 1 (Metro Hubs):** Extremely large stations (e.g., NDLS, SBC, MAS). Moving from Platform 1 to Platform 10, or exiting the station to find a bus stand, can take 30+ minutes. The minimum buffer is forced to **45 minutes**.
- **Tier 2 (District Hubs):** Moderate size. Buffer = **30 minutes**.
- **Tier 3 (Small Towns):** Small stations, easy to navigate. Buffer = **20 minutes**.

### 5.2 Slack Calculation
```javascript
export function connectionSlack(arrivalMinsAbs, departureMinsAbs) {
  return departureMinsAbs - arrivalMinsAbs;
}

export function isConnectionSafe(arrivalMinsAbs, departureMinsAbs, requiredBufferMins) {
  const slack = connectionSlack(arrivalMinsAbs, departureMinsAbs);
  return slack >= requiredBufferMins;
}
```
*Note: `arrivalMinsAbs` is calculated relative to a base epoch (usually midnight of the search date) to properly handle overnight trains crossing the midnight boundary.*

---

## 6. Frontend Architecture & Dynamic UI

The frontend (`frontend/app.js`, `frontend/index.css`) is a masterclass in vanilla DOM manipulation, optimized for performance without the overhead of Virtual DOM reconciliation (though a React migration is staged in the `react-example` setup).

### 6.1 State Management
Search state (Origin, Destination, Date, subtexts) is synced continuously to `sessionStorage`. 
```javascript
function saveSearchState() {
  const state = {
    fromInput: fromInput ? fromInput.value : '',
    // ...
  };
  sessionStorage.setItem('routeStitchSearchState', JSON.stringify(state));
}
```
This ensures that if the user accidentally refreshes, or navigates away to a booking deep-link and hits the back button, their exact search parameters are preserved.

### 6.2 Autocomplete & Dropdowns
The system fetches `unifiedLocations.json` via `/api/locations` on load. 
As the user types, a fast client-side filter runs against `name`, `erailCode`, and `searchStrings`. 
```javascript
const match = allLocations.find(loc => 
  loc.name.toLowerCase().includes(val) || 
  (loc.searchStrings && loc.searchStrings.some(s => s.toLowerCase().includes(val)))
);
```
This allows users to search by English name ("Bangalore"), local names ("Bengaluru"), or exact codes ("SBC").

### 6.3 Real-Time SSE Console
To keep the user engaged during the 2-5 second scraping phase, RouteStitch utilizes Server-Sent Events (SSE). 
The backend streams logs ("Scraping rail & bus GDS endpoints...", "Found 3 candidate interchange hubs...", "Interlining matrix generated successfully"). The frontend parses these and appends them to a simulated hacker-style console (`#console-output`), providing transparency into the algorithm's progress.

### 6.4 Dynamic Route Rendering
The `renderRoutes(routes)` function takes the JSON response and generates complex, interactive DOM structures using template literals.
- **Badges:** Dynamically assigned (`badge-direct`, `badge-train`, `badge-bus`, `badge-stitched`) based on the `connectionType`.
- **Vector Lines:** CSS is used to render visual timelines. Direct routes get a solid line (`direct-line`), while stitched routes render intermediate nodes (`vector-interchange-node` with a `node-pulse` animation).
- **Leg Details:** Iterates over the `route.legs` array, rendering distinct UI cards for Trains (showing Train Name, Number, Running Days, Availability Classes) and Buses (Operator, Bus Type, Ratings, Amenities links).
- **Interchange Banners:** Inserted between legs to highlight the layover city and the "Stitch Protection Active" status.

### 6.5 Client-Side Filtering & Sorting
The sidebar allows users to filter the results *instantly* without hitting the backend again.
```javascript
function applySidebarFilters() {
  // ... gets selected radios, checkboxes, and layover range
  cards.forEach((card) => {
    // Evaluates data-attributes generated during render
    const cardType = card.getAttribute('data-type');
    const conn = card.getAttribute('data-connection');
    // ... toggles display: block | none
  });
}
```
This is highly performant because it relies purely on CSS class toggling and DOM data attributes.

---

## 7. Data Acquisition & Scraping Mechanics

Because India lacks a unified, open, developer-friendly API for all rail and bus data, RouteStitch relies on sophisticated scraping.

### 7.1 Train Data (eRail Scraper)
The backend uses Playwright/Cheerio to interface with `erail.in`.
1. `scrapeErailJs.cjs` can spin up a headless browser to execute client-side JavaScript on the target site if required, though `eRailText.js` utilizes raw HTTP endpoints when possible for speed.
2. The scrapers extract Train Number, Name, Departure, Arrival, Travel Time, and crucially, Availability & Fares for different classes (SL, 3A, 2A).
3. The data is heavily sanitized. Raw text like `₹1,200` is parsed into raw integers `1200` for algorithmic sorting.

### 7.2 Bus Data
Bus data logic expects similar JSON arrays containing `Operator`, `Bus Type`, `Departure`, `Arrival`, `Fare`, and `Seats Available`. These are normalized by `normalizeBus()` in the `stitchEngine.js`.

### 7.3 Concurrency & Timeout Handling
Scraping is inherently fragile. RouteStitch implements multiple safeguards:
- **`p-queue`:** Restricts the number of concurrent browser tabs or HTTP requests to avoid IP bans.
- **Fail-safes:** If a scraper task for a specific leg (e.g., SBC -> BGM) times out, the `Promise.allSettled` mechanism ensures the entire request doesn't crash. The engine simply drops that specific subgraph branch and continues with the data it successfully retrieved.
- **Timeout Removal:** The express server is configured with `server.setTimeout(0)` to prevent the socket from closing while waiting for slow upstream scrapes on complex 3-leg journeys.

---

## 8. Error Handling & Guardrails

1. **Global Catch-Alls:** The Express app implements a global error handler ensuring no request hangs silently. It always returns a standard schema: `{ success: false, error: "message", source: "core-api" }`.
2. **Invalid Station Fallback:** If the frontend cannot map user input to a valid station code, it aborts the POST request and warns the user via the SSE console.
3. **Missing Coordinates:** If `interchangeFinder.js` cannot find lat/lon for a station, it throws a localized error, allowing the engine to degrade gracefully (e.g., falling back to direct-only search).
4. **Time Parsing:** `timeStrToMins()` handles edge cases like missing trailing AM/PM, 24-hour formats, and crossed-midnight dates natively.

---

## 9. Future Roadmap & Scaling Potential

While RouteStitch v1.1 is production-ready for demonstration, enterprise scaling requires the following architectural evolutions:

1. **Graph Database Migration:** Moving `cityRegistry.json` and static distances into a Graph DB (like Neo4j). This would allow Cypher queries to handle the detour-factor gating directly at the database layer, drastically reducing Node.js CPU overhead.
2. **Live Booking Integrations:** Transitioning from affiliate deep-links to native B2B API integrations (e.g., IRCTC API partner access, RedBus B2B API) to allow one-click checkout within the app.
3. **Advanced Delay Machine Learning:** Replacing the static `tierBasedDefaultBuffer` with a predictive ML model trained on historical NTES delay data, adjusting buffers dynamically based on weather, season, and specific train histories.
4. **React/Next.js Migration:** Utilizing the staged `react-example` setup to move the frontend to a component-based architecture for better maintainability as the UI complexity grows (e.g., user accounts, saved itineraries, payment gateways).

---
*End of Technical Guide. Maintainers: Refer to `Docs/` directory for historical design decisions and API contracts.*
