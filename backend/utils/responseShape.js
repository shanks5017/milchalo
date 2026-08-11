// utils/responseShape.js
// ──────────────────────────────────────────────────────────────────────────────
// Canonical response contract for the RouteStitch Core API.
//
// Every endpoint returns one of these two shapes:
//   Success  → { success: true,  data: <payload> }
//   Failure  → { success: false, error: { message, source? } }
//
// Using these helpers guarantees a consistent contract across the whole service
// and makes front-end error handling trivial.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build a successful response envelope.
 * @param {*} data - Any JSON-serialisable payload.
 * @returns {{ success: true, data: * }}
 */
export function successResponse(data) {
  return { success: true, data };
}

/**
 * Build an error response envelope.
 * @param {string} message   - Human-readable error description.
 * @param {string} [source]  - Optional: which upstream service caused the error
 *                             (e.g. "train-api", "bus-service", "supabase").
 * @returns {{ success: false, error: { message: string, source?: string } }}
 */
export function errorResponse(message, source) {
  const error = { message };
  if (source) error.source = source;
  return { success: false, error };
}
