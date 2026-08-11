/**
 * historyLogger.js
 * Fire-and-forget Supabase persistence for completed train journeys.
 *
 * Called by the /train/track/:trainNo handler whenever a train has reached
 * its final destination. Builds our own growing historical delay dataset
 * since NTES does not expose bulk history.
 *
 * Schema expected in Supabase (run once):
 *
 *   CREATE TABLE IF NOT EXISTS train_journey_history (
 *     id                BIGSERIAL PRIMARY KEY,
 *     train_no          TEXT        NOT NULL,
 *     journey_date      DATE        NOT NULL,
 *     timeline          JSONB       NOT NULL,
 *     final_delay_minutes INT,
 *     created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *
 * Environment variables required:
 *   SUPABASE_URL      — e.g. https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY — anon/service-role key
 *
 * If either var is absent the module logs a one-time warning and all
 * logJourney() calls become silent no-ops. This keeps the rest of the API
 * fully functional without Supabase configured.
 */

import { createClient } from "@supabase/supabase-js";

// ── Supabase client ──────────────────────────────────────────────────────────

let supabase = null;

function getClient() {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(
      "[historyLogger] SUPABASE_URL or SUPABASE_ANON_KEY not set — " +
        "journey history persistence is disabled."
    );
    return null;
  }

  supabase = createClient(url, key);
  return supabase;
}

// ── Table name ───────────────────────────────────────────────────────────────

const TABLE = "train_journey_history";

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Persist a completed journey record to Supabase.
 * This function is intentionally fire-and-forget — it never throws.
 *
 * @param {object} params
 * @param {string}  params.trainNo
 * @param {string}  params.journeyDate         "DD-MM-YYYY"
 * @param {Array}   params.timeline            Full stop array from /train/track
 * @param {number|null} params.finalDelayMinutes Delay at terminal station
 */
export async function logJourney({ trainNo, journeyDate, timeline, finalDelayMinutes }) {
  const db = getClient();
  if (!db) return; // Supabase not configured — silent no-op

  try {
    // Normalise date to ISO format for Supabase DATE column
    let isoDate = journeyDate;
    if (journeyDate && journeyDate.includes("-")) {
      const parts = journeyDate.split("-");
      if (parts[0].length === 2) {
        // DD-MM-YYYY → YYYY-MM-DD
        isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    const { error } = await db.from(TABLE).insert({
      train_no: String(trainNo),
      journey_date: isoDate,
      timeline: timeline,
      final_delay_minutes: finalDelayMinutes ?? null,
    });

    if (error) {
      console.error(`[historyLogger] Supabase insert failed for train ${trainNo}:`, error.message);
    } else {
      console.log(`[historyLogger] Logged journey: train=${trainNo} date=${isoDate} finalDelay=${finalDelayMinutes}min`);
    }
  } catch (err) {
    // Never bubble — this is fire-and-forget
    console.error("[historyLogger] Unexpected error:", err.message);
  }
}
