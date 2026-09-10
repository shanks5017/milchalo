/**
 * bookingLinks.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Generates deep-link URLs for Indian bus & train booking platforms.
 *
 * RESEARCH FINDINGS (verified by live browser testing, 2026-08-17/18):
 *
 * BUS PLATFORMS — All use session-based trip IDs internally.
 *   The deepest reliable link is the SEARCH RESULTS page pre-filled with
 *   origin, destination, and date. There is NO stable URL to a specific bus.
 *   → RedBus:   /bus-tickets/{from}-to-{to}?onward={DD-MMM-YYYY}&doj={DD-MMM-YYYY}
 *   → AbhiBus:  /bus_search/{From}/{FromId}/{To}/{ToId}/{DD-MM-YYYY}/O  (needs city ID)
 *   → MakeMyTrip Bus: /bus-tickets/{from-city}-to-{to-city}-bus-ticket-booking.html
 *   → Paytm:    tickets.paytm.com/bus/search/{From}/{To}/{YYYY-MM-DD}/1/0
 *
 * TRAIN PLATFORMS — Train number is STATIC so constructable deep links work!
 *   → IRCTC:  train-search?trainNo={no}&fromStnCode={from}&toStnCode={to}&journeyDate={DDMMYYYY}
 *   → ixigo:  trains/search-pwa/from/{FROM_CODE}/to/{TO_CODE}/{DD-MM-YYYY}
 *   → MakeMyTrip: railways/listing?date={YYYYMMDD}&srcStn={FROM}&destStn={TO}
 * ──────────────────────────────────────────────────────────────────────────────
 */

export interface BookingLink {
  platform: string;
  logo: string;      // emoji or short label for display
  logoUrl?: string;  // actual brand logo URL

  url: string;
  color: string;     // brand hex color
  type: 'search' | 'specific'; // 'specific' = train number pre-filled
}

// ── Date Formatters ──────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Parses a departure date string from the leg data.
 * Handles "YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY", ISO strings.
 * Falls back to today+1 if unparseable.
 */
function parseLegDate(dateStr?: string): Date {
  if (!dateStr) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  // Try ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }
  // Try DD-MM-YYYY or DD/MM/YYYY
  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3 && parts[0].length === 2) {
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    if (!isNaN(d.getTime())) return d;
  }
  // Fallback
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

/** DD-MMM-YYYY → "18-Aug-2026"  (RedBus format) */
function toRedBusDate(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}-${MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`;
}

/** DD-MM-YYYY → "18-08-2026"  (ixigo bus / AbhiBus format) */
function toDDMMYYYY(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

/** DDMMYYYY → "18082026"  (IRCTC journeyDate, NO separators) */
function toIrctcDate(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}${d.getFullYear()}`;
}

/** YYYYMMDD → "20260818"  (MakeMyTrip train listing date) */
function toYYYYMMDD(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
}

/** YYYY-MM-DD → "2026-08-18"  (Paytm bus date) */
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── City Slug Helper ──────────────────────────────────────────────────────────

/**
 * Converts a city name to a URL-friendly slug for RedBus.
 * e.g. "Bangalore" → "bangalore", "New Delhi" → "new-delhi"
 */
function citySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// ── Common city name → known abbreviation map for MakeMyTrip bus route slugs ─
// (pattern: {from-city}-{to-city}-bus-ticket-booking.html)
function mmtBusRouteSlug(from: string, to: string): string {
  return `${citySlug(from)}-${citySlug(to)}-bus-ticket-booking.html`;
}

// ── BUS Deep-Link Builder ─────────────────────────────────────────────────────

interface BusLinkInput {
  from: string;           // City name e.g. "Bangalore"
  to: string;             // City name e.g. "Chennai"
  departureDate?: string; // Optional date string
}

export function getBusBookingLinks(input: BusLinkInput): BookingLink[] {
  const d = parseLegDate(input.departureDate);
  const rbDate = toRedBusDate(d);
  const ddmmDate = toDDMMYYYY(d);
  const paytmDate = toISO(d);

  const fromSlug = citySlug(input.from);
  const toSlug = citySlug(input.to);

  return [
    {
      platform: 'redBus',
      logo: '🔴',
      logoUrl: 'https://www.google.com/s2/favicons?sz=64&domain=redbus.in',
      color: '#d84e55',
      type: 'search',
      url: `https://www.redbus.in/bus-tickets/${fromSlug}-to-${toSlug}?onward=${rbDate}&doj=${rbDate}`,
    },
    {
      platform: 'AbhiBus',
      logo: '🟣',
      logoUrl: 'https://www.google.com/s2/favicons?sz=64&domain=abhibus.com',
      color: '#6b3fa0',
      type: 'search',
      url: `https://www.abhibus.com/bus_search/${encodeURIComponent(input.from)}/${encodeURIComponent(input.to)}/${ddmmDate}/O`,
    },
    {
      platform: 'MakeMyTrip',
      logo: '🔵',
      logoUrl: 'https://www.google.com/s2/favicons?sz=64&domain=makemytrip.com',
      color: '#1a73e8',
      type: 'search',
      url: `https://www.makemytrip.com/bus-tickets/${mmtBusRouteSlug(input.from, input.to)}`,
    },
    {
      platform: 'Paytm',
      logo: '🔷',
      logoUrl: 'https://www.google.com/s2/favicons?sz=64&domain=paytm.com',
      color: '#00baf2',
      type: 'search',
      url: `https://tickets.paytm.com/bus/search/${encodeURIComponent(input.from)}/${encodeURIComponent(input.to)}/${paytmDate}/1/0`,
    },
    {
      platform: 'ixigo',
      logo: '🟠',
      logoUrl: 'https://www.google.com/s2/favicons?sz=64&domain=ixigo.com',
      color: '#ff6f00',
      type: 'search',
      url: `https://www.ixigo.com/buses/bus_search/${encodeURIComponent(input.from)}/${encodeURIComponent(input.to)}/${ddmmDate}/O`,
    },
  ];
}

// ── TRAIN Deep-Link Builder ───────────────────────────────────────────────────

interface TrainLinkInput {
  trainNo?: string | null;   // e.g. "12951"
  trainName?: string | null; // e.g. "Mumbai Rajdhani"
  fromCode: string;          // Station code e.g. "NDLS"
  toCode: string;            // Station code e.g. "BCT"
  departureDate?: string;
  classCode?: string;        // "SL", "3A", "2A", "1A", "CC" etc.
}

export function getTrainBookingLinks(input: TrainLinkInput): BookingLink[] {
  const d = parseLegDate(input.departureDate);
  const irctcDate = toIrctcDate(d);   // DDMMYYYY
  const ixigoDate = toDDMMYYYY(d);    // DD-MM-YYYY
  const mmtDate = toYYYYMMDD(d);      // YYYYMMDD

  const classCode = input.classCode || 'SL';
  const trainNo = input.trainNo || '';
  const links: BookingLink[] = [];

  // IRCTC — most authoritative, pre-fills the specific train number
  // Verified: shows train-search page with trainNo param. User still needs to click Book.
  if (trainNo) {
    links.push({
      platform: 'IRCTC',
      logo: '🟠',
      logoUrl: 'https://www.google.com/s2/favicons?sz=64&domain=irctc.co.in',
      color: '#0066cc',
      type: 'specific',
      url: `https://www.irctc.co.in/nget/train-search?trainNo=${trainNo}&fromStnCode=${input.fromCode}&toStnCode=${input.toCode}&journeyDate=${irctcDate}&classCode=${classCode}&quotaCode=GN`,
    });
  }

  // ixigo — search results pre-filtered for this route & date
  links.push({
    platform: 'ixigo',
    logo: '🟠',
    logoUrl: 'https://www.google.com/s2/favicons?sz=64&domain=ixigo.com',
    color: '#ff6f00',
    type: trainNo ? 'specific' : 'search',
    url: `https://www.ixigo.com/trains/search-pwa/from/${input.fromCode}/to/${input.toCode}/${ixigoDate}`,
  });

  // MakeMyTrip — listing page with route & date
  // Verified: https://www.makemytrip.com/railways/listing?date=YYYYMMDD&srcStn=SBC&destStn=MAS WORKS
  links.push({
    platform: 'MakeMyTrip',
    logo: '🔵',
    logoUrl: 'https://www.google.com/s2/favicons?sz=64&domain=makemytrip.com',
    color: '#1a73e8',
    type: 'search',
    url: `https://www.makemytrip.com/railways/listing?date=${mmtDate}&srcStn=${input.fromCode}&destStn=${input.toCode}`,
  });

  // Cleartrip — train search
  links.push({
    platform: 'Cleartrip',
    logo: '🔷',
    logoUrl: 'https://www.google.com/s2/favicons?sz=64&domain=cleartrip.com',
    color: '#e87722',
    type: 'search',
    url: `https://www.cleartrip.com/trains/results?from=${input.fromCode}&to=${input.toCode}&departure=${ixigoDate}&class=${classCode}&adults=1`,
  });

  return links;
}

// ── Unified entry point (used by JourneyDetailsPage) ─────────────────────────

export interface LegForBooking {
  mode: 'train' | 'bus';
  from: string;
  to: string;
  trainNo?: string | null;
  trainName?: string | null;
  departureDate?: string;
  // Station codes – derived from the leg's `from`/`to` fields or passed separately
  fromCode?: string;
  toCode?: string;
  classCode?: string;
}

/**
 * Returns the most relevant booking links for a given journey leg.
 * Bus legs → bus platforms; Train legs → train platforms.
 */
export function getBookingLinksForLeg(leg: LegForBooking): BookingLink[] {
  if (leg.mode === 'bus') {
    return getBusBookingLinks({
      from: leg.from,
      to: leg.to,
      departureDate: leg.departureDate,
    });
  }

  // For trains: try to extract station codes from the leg's from/to strings.
  // The backend typically sets leg.from like "NEW DELHI (NDLS)" or just "NDLS".
  // We extract the bracketed code if present, else use the raw string.
  const fromCode = leg.fromCode || extractStationCode(leg.from);
  const toCode   = leg.toCode   || extractStationCode(leg.to);

  return getTrainBookingLinks({
    trainNo: leg.trainNo,
    trainName: leg.trainName,
    fromCode,
    toCode,
    departureDate: leg.departureDate,
    classCode: leg.classCode,
  });
}

/**
 * Extracts station code from strings like:
 *   "NEW DELHI (NDLS)"  → "NDLS"
 *   "NDLS"              → "NDLS"
 *   "Bangalore"         → "Bangalore"  (falls back to full name for buses)
 */
export function extractStationCode(name: string): string {
  const match = name.match(/\(([A-Z]{2,5})\)/);
  if (match) return match[1];
  // If it's already a short all-caps code (2–5 chars), use it directly
  if (/^[A-Z]{2,5}$/.test(name.trim())) return name.trim();
  return name;
}
