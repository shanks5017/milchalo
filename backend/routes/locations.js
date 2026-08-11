// routes/locations.js
// ──────────────────────────────────────────────────────────────────────────────
// GET /api/locations — Unified Location Registry API
//
// Serves the static unifiedLocations.json file. This provides the frontend
// with a clean, instantly-searchable list of supported cities, mapping them
// to BOTH erail codes and IRCTC Bus IDs.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { successResponse, errorResponse } from "../utils/responseShape.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Load the JSON once into memory when the server starts
let locationsData = null;
try {
  const filePath = path.join(__dirname, "../algorithms/unifiedLocations.json");
  const rawData = fs.readFileSync(filePath, "utf8");
  locationsData = JSON.parse(rawData);
} catch (e) {
  console.error("[locationsApi] Failed to load unifiedLocations.json. Did you run buildLocationRegistry.js?", e.message);
}

/**
 * GET /api/locations
 * Returns the entire array of unified locations.
 * Intended to be cached heavily by the frontend for offline autocomplete.
 */
router.get("/", (req, res) => {
  if (!locationsData) {
    return res.status(500).json(
      errorResponse(
        "Location registry not loaded on the server.",
        "server-configuration"
      )
    );
  }
  
  return res.json(successResponse(locationsData));
});

export default router;
