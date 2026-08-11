/**
 * cache.js
 * In-memory TTL cache using node-cache.
 * Default TTL: 300 s (5 min). Adjust per-call with the ttl param.
 * Key helpers keep the format canonical so callers never build strings ad-hoc.
 */

import NodeCache from "node-cache";

const DEFAULT_TTL = 300; // seconds

const store = new NodeCache({ stdTTL: DEFAULT_TTL, checkperiod: 60 });

export const cache = {
  /** @param {string} key */
  get(key) {
    return store.get(key) ?? null;
  },

  /**
   * @param {string} key
   * @param {*} value
   * @param {number} [ttl]  seconds, defaults to DEFAULT_TTL
   */
  set(key, value, ttl = DEFAULT_TTL) {
    store.set(key, value, ttl);
  },

  /** @param {string} key */
  del(key) {
    store.del(key);
  },

  /** Flush everything — useful in tests */
  flush() {
    store.flushAll();
  },
};

// ── Key builders ────────────────────────────────────────────────────────────

export function trainKey(trainNo, date) {
  return `train:${trainNo}:${date ?? "latest"}`;
}

export function stationKey(stationCode, hours) {
  return `station:${stationCode}:${hours ?? 2}`;
}
