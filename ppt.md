# RouteStitch Pitch Deck

This document contains a 10-slide pitch presentation for RouteStitch, designed for a senior software engineering or product presentation. Each slide includes the visual content to display and the exact speaker notes to deliver.

---

## Slide 1: Title Slide
**Visual / Text on Slide:**
*   **Title:** RouteStitch
*   **Subtitle:** Seamlessly Connecting India's Tier-2 & Tier-3 Cities.
*   **Tagline:** The intelligent multi-leg journey engine for train and bus travel.
*   **Visual:** RouteStitch Logo, clean modern background.

**Speaker Notes:**
> "Good morning. I'm here to introduce RouteStitch. We are building the intelligent multi-leg journey engine designed specifically to solve the hardest travel problem in India: connecting Tier-2 and Tier-3 cities seamlessly."

---

## Slide 2: The Problem
**Visual / Text on Slide:**
*   **Heading:** The "No Direct Route" Dead End
*   **Points:**
    *   Existing platforms (IRCTC, RedBus, MakeMyTrip) only solve for **single-mode, direct searches**.
    *   If no direct train or bus exists, the user gets zero results.
    *   Travelers are forced to manually guess interchange cities, check 3 different apps, and self-calculate safe connection times.
*   **Visual:** Screenshot of a standard app showing "No Trains Found" vs. a frustrated user juggling multiple apps.

**Speaker Notes:**
> "Today's Indian travel platforms are fundamentally broken for indirect routes. If you search for a trip between two smaller cities and there's no direct bus or train, you hit a dead end. RedBus and IRCTC just return empty screens. Travelers have to guess where to interchange, juggle multiple tabs, and do the math themselves to figure out if they can make the connection. It's frustrating and time-consuming."

---

## Slide 3: The Target Market
**Visual / Text on Slide:**
*   **Heading:** Millions of Underserved Journeys
*   **Points:**
    *   **The User:** Travelers moving between Tier-2 and Tier-3 cities in India.
    *   **The Need:** A unified way to discover, compare, and trust indirect travel routes.
    *   **The Reality:** The *majority* of real journeys across India require a mode switch (bus-to-train, train-to-bus).

**Speaker Notes:**
> "This isn't an edge case. The majority of real-world travel between India's thousands of Tier-2 and Tier-3 cities requires changing transport. Our target user is that traveler who needs to get from point A to point B, has no direct option, and wants to compare the fastest, cheapest, or most reliable multi-leg alternatives without doing hours of homework."

---

## Slide 4: The Solution - RouteStitch
**Visual / Text on Slide:**
*   **Heading:** Automated, Intelligent Journey Stitching
*   **Points:**
    *   **Unified Search:** Enters Origin and Destination — we do the rest.
    *   **Cross-Modal:** Computes train+bus, bus+bus, and train+train combinations.
    *   **Realistic Buffers:** Automatically calculates safe interchange times based on city tiers.
    *   **Actionable:** Deep-links directly to booking platforms with pre-filled details.
*   **Visual:** Mockup of the RouteStitch app showing a stitched journey (e.g., Train to Hub -> Bus to Destination).

**Speaker Notes:**
> "Enter RouteStitch. We solve this by automatically computing multi-leg journeys. You give us the origin and destination, and we stitch together the perfect route across trains and buses. We don't just find the connections; we calculate realistic, geographically-aware buffer times so you don't miss your connection. And when you're ready, we deep-link you directly to the source platform to book it instantly."

---

## Slide 5: The User Journey
**Visual / Text on Slide:**
*   **Heading:** Simple, Transparent, and Honest
*   **Points:**
    *   **Direct First:** We never hide direct routes if they exist.
    *   **Ranked Options:** Top 3 itineraries ranked by fastest, cheapest, and most reliable.
    *   **Data Honesty:** Clear badges distinguishing "Live" tracking data vs. "Estimated" historical data.
    *   **Full Control:** Users can manually override interchange cities and buffer times.

**Speaker Notes:**
> "The user experience is built on transparency. If a direct route exists, we show it first. If not, we present the top two or three multi-leg options, ranking them by speed, cost, and reliability. We are fiercely honest about our data—if a train's delay is based on live tracking, we badge it 'Live'. If it's a historical average, we say 'Estimated'. We empower the user with great defaults, but give them full control to override."

---

## Slide 6: Under the Hood - Algorithm & Geometry
**Visual / Text on Slide:**
*   **Heading:** Defeating "Hallucinated" Interchanges
*   **Points:**
    *   **Deterministic Math, Not AI Guesses:** We don't use LLMs for routing. We use hard geometry.
    *   **Detour-Factor Testing:** `Distance(A, Hub) + Distance(Hub, B) ≤ Distance(A, B) × 1.3`
    *   **Hub Connectivity Ranking:** Geographically valid cities are ranked by actual transport density.
*   **Visual:** A simple map graphic showing a valid interchange (inside the detour ellipse) vs an invalid one (e.g., Delhi for a South Indian trip).

**Speaker Notes:**
> "From an engineering perspective, how do we prevent the system from suggesting absurd interchanges—like stopping in Delhi for a trip between two southern cities? We use deterministic math, not AI guesswork. Our engine applies a geometric detour-factor test to ensure the interchange city actually lies on a logical path. We then rank those valid candidates by their real-world connectivity, ensuring we route you through active transport hubs."

---

## Slide 7: Under the Hood - Smart Buffering
**Visual / Text on Slide:**
*   **Heading:** Reliability Through Tier-Aware Buffering
*   **Points:**
    *   **Dynamic Time-Windows:** Time-windowed Dijkstra algorithm for pathfinding.
    *   **Tier-Based Defaults:**
        *   Tier 1 City (High chaos): 45 min buffer
        *   Tier 2 City: 30 min buffer
        *   Tier 3 City (Low traffic): 20 min buffer
    *   **Mode-Agnostic Scoring:** Trains and buses compete fairly on time, cost, and reliability.

**Speaker Notes:**
> "Connecting routes are useless if you miss the connection. Our routing algorithm uses a modified time-windowed Dijkstra approach. Crucially, we apply Tier-Based Buffering. We know that switching buses in a chaotic Tier 1 city takes longer than a Tier 3 town. We automatically apply a 45-minute buffer for metros, down to 20 minutes for smaller towns, ensuring the math matches reality."

---

## Slide 8: System Architecture
**Visual / Text on Slide:**
*   **Heading:** Enterprise-Grade Prototype
*   **Points:**
    *   **Polyglot Microservices:** Node.js (Core API/Train) + Python (Bus Scraper/FastAPI).
    *   **Database:** Supabase (PostgreSQL) for graphs, delay history, and caching.
    *   **Resilience:** Built-in process supervision and self-healing orchestrator.
    *   **Resource Safety:** Shared headless browser pools to prevent memory exhaustion.
*   **Visual:** High-level architecture diagram showing React Frontend -> Node API -> Python Service & Supabase.

**Speaker Notes:**
> "We built this to industry standards, not as a toy demo. Our architecture utilizes a polyglot microservice pattern: a highly concurrent Node.js core orchestrates a specialized Python scraping service. We back this with Supabase for spatial data and caching. To handle the heavy lifting of live data scraping, we implemented strict resource safety with shared headless browser pools and automated process supervision to ensure maximum uptime."

---

## Slide 9: Roadmap & Business Model
**Visual / Text on Slide:**
*   **Heading:** MVP to Monetization
*   **Phase 1 (Current):** Free-tier scraping, deep-linking, core stitching engine.
*   **Phase 2 (Next):** Live delay alerts, dynamic rerouting suggestions, LLM-assisted natural language search.
*   **Phase 3 (Funded):** Licensed partner APIs (RedBus, IRCTC) and "Book All" unified checkout.
*   **Revenue:** Affiliate commissions on deep-links initially, evolving to convenience fees on unified checkout.

**Speaker Notes:**
> "Our roadmap is pragmatic. Right now, we've built the core stitching engine using internal scrapers and deep-linking, which keeps legal risk low while proving the concept. In Phase 2, we introduce live delay alerts and dynamic rerouting. Once funded, we will swap our internal scrapers for official, paid partner APIs to enable a seamless 'Book All' checkout experience. Our initial revenue comes from affiliate commissions, evolving into transaction fees."

---

## Slide 10: Conclusion
**Visual / Text on Slide:**
*   **Heading:** Stitching the Nation Together
*   **Points:**
    *   Solving a massive, ignored problem for millions of travelers.
    *   Defensible, mathematically rigorous routing engine.
    *   Built to scale from day one.
*   **Call to Action:** Let's make every journey connected. Thank You.
*   **Visual:** RouteStitch Logo and contact info.

**Speaker Notes:**
> "In conclusion, RouteStitch isn't just another travel app. We are solving a massive, structurally ignored problem for millions of Indian travelers. We've built a defensible, mathematically rigorous engine that scales, designed specifically for the realities of Indian geography and transit. Thank you for your time, and I'm happy to take any questions on the architecture or the product."
