import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// From interchangeFinder.js
const STATION_TO_CITY = {
  // Karnataka
  SBC:  { city: "Bangalore",    lat: 12.978, lon: 77.595, aliases: ["Bengaluru"] },
  SMVB: { city: "Bangalore",    lat: 13.198, lon: 77.706, aliases: ["Bengaluru"] },
  YPR:  { city: "Bangalore",    lat: 13.016, lon: 77.551, aliases: ["Bengaluru"] },
  BGM:  { city: "Belagavi",     lat: 15.860, lon: 74.508, aliases: ["Belgaum"] },
  UBL:  { city: "Dharwad",      lat: 15.361, lon: 75.124, aliases: ["Hubli", "Hubballi"] },
  DWR:  { city: "Dharwad",      lat: 15.361, lon: 75.124 },
  HPT:  { city: "Koppal",       lat: 15.362, lon: 76.462, aliases: ["Hospet"] },
  GDG:  { city: "Gadag",        lat: 15.431, lon: 75.634 },
  HVR:  { city: "Haveri",       lat: 14.796, lon: 75.402 },
  DVG:  { city: "Davangere",    lat: 14.466, lon: 75.923, aliases: ["Davanagere"] },
  ASK:  { city: "Hassan",       lat: 13.008, lon: 76.099 },
  MYS:  { city: "Mysore",       lat: 12.295, lon: 76.639, aliases: ["Mysuru"] },
  MYA:  { city: "Mandya",       lat: 12.524, lon: 76.895 },
  BAND: { city: "Bengaluru Rural", lat: 13.120, lon: 77.660 },
  // Tamil Nadu
  CBE:  { city: "Coimbatore",   lat: 10.996, lon: 76.965 },
  MAS:  { city: "Chennai",      lat: 13.082, lon: 80.275 },
  MS:   { city: "Chennai",      lat: 13.082, lon: 80.275 },
  MDU:  { city: "Madurai",      lat: 9.919,  lon: 78.119 },
  TPJ:  { city: "Trichy",       lat: 10.804, lon: 78.686, aliases: ["Tiruchirappalli"] },
  SA:   { city: "Salem",        lat: 11.663, lon: 78.146 },
  CBF:  { city: "Coimbatore",   lat: 10.996, lon: 76.965 },
  ED:   { city: "Erode",        lat: 11.341, lon: 77.727 },
  TUP:  { city: "Tirupur",      lat: 11.108, lon: 77.340, aliases: ["Tiruppur"] },
  NCJ:  { city: "Tirunelveli",  lat: 8.731,  lon: 77.738 },
  // Andhra / Telangana
  SC:   { city: "Hyderabad",    lat: 17.432, lon: 78.502, aliases: ["Secunderabad"] },
  HYB:  { city: "Hyderabad",    lat: 17.432, lon: 78.502 },
  NZB:  { city: "Nizamabad",    lat: 18.673, lon: 78.097 },
  BZA:  { city: "Vijayawada",   lat: 16.516, lon: 80.615 },
  GNT:  { city: "Guntur",       lat: 16.306, lon: 80.437 },
  VSKP: { city: "Visakhapatnam",lat: 17.686, lon: 83.218, aliases: ["Vizag"] },
  // Maharashtra
  CSTM: { city: "Mumbai",       lat: 18.940, lon: 72.835 },
  LTT:  { city: "Mumbai",       lat: 19.074, lon: 72.891 },
  BDTS: { city: "Mumbai",       lat: 19.025, lon: 72.835 },
  BST:  { city: "Mumbai",       lat: 19.010, lon: 72.841 },
  PNVL: { city: "Panvel",       lat: 18.990, lon: 73.110 },
  PUNE: { city: "Pune",         lat: 18.529, lon: 73.874 },
  PA:   { city: "Pune",         lat: 18.529, lon: 73.874 },
  NGP:  { city: "Nagpur",       lat: 21.150, lon: 79.089 },
  SLI:  { city: "Sangli",       lat: 16.855, lon: 74.565 },
  SL:   { city: "Sangli",       lat: 16.855, lon: 74.565 },
  KOP:  { city: "Kolhapur",     lat: 16.705, lon: 74.243 },
  AK:   { city: "Akola",        lat: 20.706, lon: 77.001 },
  // Rajasthan
  JP:   { city: "Jaipur",       lat: 26.919, lon: 75.788 },
  JU:   { city: "Jodhpur",      lat: 26.295, lon: 73.017 },
  AII:  { city: "Ajmer",        lat: 26.448, lon: 74.639 },
  // Delhi
  NDLS: { city: "Delhi",        lat: 28.641, lon: 77.219, aliases: ["New Delhi"] },
  NZM:  { city: "Delhi",        lat: 28.569, lon: 77.249 },
  DLI:  { city: "Delhi",        lat: 28.641, lon: 77.219 },
  // UP
  CNB:  { city: "Kanpur",       lat: 26.449, lon: 80.331 },
  LKO:  { city: "Lucknow",      lat: 26.838, lon: 80.946 },
  BSB:  { city: "Varanasi",     lat: 25.321, lon: 82.999 },
  ALD:  { city: "Prayagraj",    lat: 25.445, lon: 81.840 },
  AGC:  { city: "Agra",         lat: 27.198, lon: 78.028 },
  // Others
  HWH:  { city: "Kolkata",      lat: 22.572, lon: 88.364 },
  KOAA: { city: "Kolkata",      lat: 22.572, lon: 88.364 },
  PNBE: { city: "Patna",        lat: 25.610, lon: 85.142 },
  ADI:  { city: "Ahmedabad",    lat: 23.027, lon: 72.575 },
  ST:   { city: "Surat",        lat: 21.195, lon: 72.831 },
  BRC:  { city: "Vadodara",     lat: 22.309, lon: 73.181 },
  BPL:  { city: "Bhopal",       lat: 23.259, lon: 77.412 },
  GWL:  { city: "Gwalior",      lat: 26.218, lon: 78.182 },
  INDB: { city: "Indore",       lat: 22.718, lon: 75.857 },
  // Punjab / Haryana
  LDH:  { city: "Ludhiana",     lat: 30.901, lon: 75.857 },
  ASR:  { city: "Amritsar",     lat: 31.634, lon: 74.872 },
  CDG:  { city: "Chandigarh",   lat: 30.733, lon: 76.779 },
  // Kerala
  TVC:  { city: "Trivandrum",   lat: 8.524, lon: 76.936, aliases: ["Thiruvananthapuram"] },
  ERS:  { city: "Ernakulam",    lat: 9.982,  lon: 76.300, aliases: ["Kochi", "Cochin"] },
  SRR:  { city: "Kannur",       lat: 11.868, lon: 75.371 },
  CLT:  { city: "Kozhikode",    lat: 11.249, lon: 75.780 },
  // Odisha
  BBS:  { city: "Bhubaneswar",  lat: 20.296, lon: 85.825 },
  // Assam
  GHY:  { city: "Guwahati",     lat: 26.166, lon: 91.736 }
};

const delay = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchIrctcCityCode(page, searchTerm) {
  const apiUrl = `https://www.bus.irctc.co.in/IrctcBus/api/busmst/getCityLike?city=${encodeURIComponent(searchTerm)}`;
  const result = await page.evaluate(async (url) => {
    try {
      const res = await fetch(url);
      return await res.json();
    } catch (e) {
      return null;
    }
  }, apiUrl);
  
  if (result?.data?.length > 0) {
    return {
      id: String(result.data[0].value),
      name: result.data[0].label
    };
  }
  return null;
}

(async () => {
  console.log("Launching Playwright to build unified location registry...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Initialize session
  await page.goto("https://www.bus.irctc.co.in/home", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(()=>{});

  const finalRegistry = [];
  
  for (const [erailCode, data] of Object.entries(STATION_TO_CITY)) {
    console.log(`Processing [${erailCode}] ${data.city}...`);
    
    // Try primary name
    let busMatch = await fetchIrctcCityCode(page, data.city);
    await delay(300); // Respect rate limits
    
    // Try aliases if primary failed
    if (!busMatch && data.aliases) {
      for (const alias of data.aliases) {
        console.log(`  -> Primary failed, trying alias: ${alias}`);
        busMatch = await fetchIrctcCityCode(page, alias);
        await delay(300);
        if (busMatch) break;
      }
    }
    
    // Add to registry
    finalRegistry.push({
      erailCode,
      name: data.city,
      aliases: data.aliases || [],
      lat: data.lat,
      lon: data.lon,
      busId: busMatch ? busMatch.id : null,
      busName: busMatch ? busMatch.name : null,
      searchStrings: [data.city, erailCode, ...(data.aliases || [])].map(s => s.toLowerCase())
    });
    
    if (busMatch) {
      console.log(`  ✅ Mapped to IRCTC Bus ID: ${busMatch.id} (${busMatch.name})`);
    } else {
      console.log(`  ❌ Could not find IRCTC Bus mapping`);
    }
  }

  const outputPath = path.join(__dirname, "../algorithms/unifiedLocations.json");
  fs.writeFileSync(outputPath, JSON.stringify(finalRegistry, null, 2));
  
  console.log(`\nSuccess! Wrote ${finalRegistry.length} locations to ${outputPath}`);
  
  await browser.close();
})();
