# RouteStitch — LLM Integration Strategy (Groq)

## 1. Governing Principle

**LLMs are used only where the task is genuinely probabilistic/linguistic. Anything with a provably correct deterministic answer (interchange-city selection, route ranking, buffer math) stays pure algorithm — no LLM in that path.** This was an explicit decision, not an oversight: an LLM "verifying" geometric detour-factor math adds latency, cost, and a new hallucination risk to a problem that already has a mathematically correct answer. See `03_ALGORITHM_DESIGN.md`.

## 2. Where Groq Actually Adds Value

| Use case | Why it's a good LLM fit | Where it plugs in |
|---|---|---|
| **Fuzzy city/station name resolution** | User input like "Blore", "Bengaluru", "Bangalore City" needs normalization to a canonical city ID; genuinely ambiguous/linguistic, not geometric | Input layer, before `graphBuilder.js` — resolve to canonical `location_id` before anything else runs |
| **Natural-language route summaries** | Turning a structured itinerary into a readable one-liner ("Fastest via Mysore — saves 2h vs. direct bus") is a language-generation task | Route Detail / Search Results UI, generated server-side from already-computed itinerary data (LLM never decides the route, only describes it) |
| **Free-text bus-type parsing at import time** | Messy strings like `"2+2 Semi Sleeper, Air Suspension, Hi-Tech"` → structured tags is partly a language-understanding task, especially for edge cases regex/keyword-matching misses (see the "Non-Video" double-tagging bug found in `04_DATA_PIPELINE.md`) | Offline data-cleaning pipeline (Python), not runtime — this is a batch job, so rate limits matter less |
| **Delay-alert message generation** | Turning `{delayMinutes: 23, affectedLeg: ...}` into a clear, calm user-facing alert message | Phase 2 alerting feature |

## 3. Where Groq Is Explicitly *Not* Used

- Interchange city selection (pure geometry — `03_ALGORITHM_DESIGN.md` §3)
- Route ranking/scoring (pure weighted math)
- Buffer time calculation (deterministic formula + historical averages)
- Any place where a wrong LLM output could silently corrupt a route recommendation shown to a user planning real travel

## 4. Rate-Limit-Aware Design (per verified free-tier facts, `05_TECH_STACK_AND_COSTS.md`)

Since Groq's free tier is capped per-organization (not per-key) and the per-minute token limit is the real bottleneck:

- **Never put an LLM call in the hot path of every search request** at MVP scale — a busy demo/testing session could burn the per-minute budget in a handful of searches. Fuzzy city-name resolution should be **cached** (once "Blore" resolves to Bangalore, store that mapping, don't re-call the LLM for the same input).
- **Batch the import-time bus-type parsing** into off-peak, low-frequency calls (it's a one-time cleaning pass, not a live path) — fits comfortably within free-tier daily caps.
- **Route summaries generated on-demand, only when a user opens Route Detail** (not for every candidate route on the results page) — keeps volume proportional to actual engagement, not search volume.
- If free-tier limits are hit during demo/development, the **Developer tier requires no minimum spend**, just a card on file, for ~10x headroom — acceptable fallback if needed for a live demo.

## 5. Integration Pattern

OpenAI-SDK-compatible endpoint means minimal integration surface:

```javascript
import OpenAI from 'openai';
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});
```

Wrap every Groq call in the same `{success, data/error}` contract as the rest of the system (`06_ERROR_HANDLING_AND_RESILIENCE.md` §1) — an LLM call failing (rate limit, timeout) must degrade gracefully: fuzzy city matching falls back to exact-match-only, route summaries fall back to a template string, never a broken UI.

## 6. Framing for Presentation (industry-grade, not gimmick)

When this is shown as a prototype, the correct framing is: **"LLM-assisted where language understanding is genuinely needed, algorithmic where correctness is provable."** This is a stronger, more defensible pitch than "AI-powered everything" — it shows deliberate engineering judgment about where LLMs help versus where they introduce unnecessary risk, which is exactly the distinction a real engineering team would be expected to make.
