import Prettify from "./train/prettify.js";
import UserAgent from "user-agents";
const prettify = new Prettify();
const ERAIL_TIMEOUT_MS = 15000;

async function erailFetch(url, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ERAIL_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": new UserAgent().toString(),
        ...extraHeaders,
      },
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`erail.in timeout after ${ERAIL_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search for train services between two stations on a date using erail.in
 *
 * @param {string} from - Source station code (e.g., CBE)
 * @param {string} to   - Destination station code (e.g., SBC)
 * @param {string} date - DD-MM-YYYY format
 * @returns {Promise<object[]>} Array of train service objects
 */
export async function searchTrainServices(from, to, date) {
  const url = `https://erail.in/rail/getTrains.aspx?Station_From=${from}&Station_To=${to}&DataSource=0&Language=0&Cache=true`;

  const response = await erailFetch(url);
  const data = await response.text();
  const json = prettify.BetweenStation(data);

  if (!json.success) {
    // e.g. "No direct trains found"
    return [];
  }

  const parts = date.split("-");
  const DD = parts[0];
  const MM = parts[1];
  const YYYY = parts[2];

  // MM is 0-indexed in Date constructor, so subtract 1
  const dayIndex = prettify.getDayOnDate(DD, parseInt(MM, 10) - 1, YYYY);

  // Filter trains that run on the specified day
  const validTrains = json.data.filter(
    (ele) => ele.train_base.running_days[dayIndex] == 1
  );

  // Map to standardized output like bus scraper
  const mappedTrains = validTrains.map((item) => {
    const t = item.train_base;
    return {
      trainNo: t.train_no,
      trainName: t.train_name,
      operator: "Indian Railways",
      fromStation: t.from_stn_code,
      toStation: t.to_stn_code,
      departureTime: t.from_time,
      arrivalTime: t.to_time,
      travelTime: t.travel_time,
      runningDays: t.running_days,
      availability: t.fares || []
    };
  });

  return mappedTrains;
}
