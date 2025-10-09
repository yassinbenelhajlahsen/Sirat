import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { City } from "../util/cities";
import { resolveAutoMethod } from "../util/methodResolver";

export interface PrayerTime {
  label: string;
  time: string;
}

export interface PrayerSettings {
  useLocation: boolean;
  method: number; // calculation method (-1 = Auto)
  city?: City;
}

type CalendarCache = {
  settingsKey: string;
  year: number;
  data: Record<string, PrayerTime[]>;
};

// in-memory cache
let cachedCalendars: Record<number, CalendarCache> = {};

export function formatTo12Hour(time24: string): string {
  const clean = time24.split(" ")[0]; // strip "+05:00"
  const [hoursStr, minutesStr] = clean.split(":");
  let hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

function settingsToKey(settings: PrayerSettings) {
  return JSON.stringify({
    useLocation: settings.useLocation,
    method: settings.method,
    city: settings.city?.name || "",
  });
}

async function saveToStorage(year: number, cache: CalendarCache) {
  try {
    await AsyncStorage.setItem(
      `prayerCalendar-${year}-${cache.settingsKey}`,
      JSON.stringify(cache)
    );
  } catch (e) {
    console.warn("Failed to save prayer calendar:", e);
  }
}

async function loadFromStorage(
  year: number,
  settingsKey: string
): Promise<CalendarCache | null> {
  try {
    const val = await AsyncStorage.getItem(
      `prayerCalendar-${year}-${settingsKey}`
    );
    if (!val) return null;
    return JSON.parse(val);
  } catch (e) {
    console.warn("Failed to load prayer calendar:", e);
    return null;
  }
}

async function fetchYearCalendar(
  year: number,
  settings: PrayerSettings
): Promise<CalendarCache> {
  let latitude: number;
  let longitude: number;
  let country = "";

  if (settings.useLocation) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted")
      throw new Error("Location permission not granted");

    const loc = await Location.getCurrentPositionAsync({});
    latitude = loc.coords.latitude;
    longitude = loc.coords.longitude;

    const geo = await Location.reverseGeocodeAsync(loc.coords);
    if (geo.length > 0 && geo[0].country) country = geo[0].country;
  } else {
    if (!settings.city)
      throw new Error("City must be provided when location is disabled");
    latitude = settings.city.lat;
    longitude = settings.city.lng;
  }

  let method = settings.method;
  if (method === -1) method = resolveAutoMethod(country);

  const allTimes: Record<string, PrayerTime[]> = {};
  const MAX_RETRIES = 3;
  const BACKOFF_BASE_MS = 2000; // 2s -> 4s -> 8s

  for (let month = 1; month <= 12; month++) {
    let attempt = 0;
    let success = false;

    while (attempt < MAX_RETRIES && !success) {
      try {
        const url = `https://api.aladhan.com/v1/calendar?latitude=${latitude}&longitude=${longitude}&method=${method}&month=${month}&year=${year}`;
        const res = await fetch(url);

        if (!res.ok) {
          if (res.status === 429) {
            console.warn(`⏳ Rate limit hit (month ${month}), backing off...`);
            await new Promise((r) =>
              setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, attempt))
            );
            attempt++;
            continue;
          }
          throw new Error(`Failed to fetch prayer times: ${res.status}`);
        }

        const data = await res.json();
        if (!data?.data) throw new Error("Invalid response from API");

        data.data.forEach((day: any) => {
          const greg = day.date.gregorian.date; // "01-01-2025"
          const [d, m, y] = greg.split("-").map((x: string) => parseInt(x));
          const isoKey = new Date(y, m - 1, d).toISOString().split("T")[0];

          allTimes[isoKey] = [
            { label: "Fajr", time: formatTo12Hour(day.timings.Fajr) },
            { label: "Sunrise", time: formatTo12Hour(day.timings.Sunrise) },
            { label: "Dhuhr", time: formatTo12Hour(day.timings.Dhuhr) },
            { label: "Asr", time: formatTo12Hour(day.timings.Asr) },
            { label: "Maghrib", time: formatTo12Hour(day.timings.Maghrib) },
            { label: "Isha", time: formatTo12Hour(day.timings.Isha) },
          ];
        });

        success = true;
      } catch (err: any) {
        console.warn(
          `⚠️ Error fetching month ${month} (try ${attempt + 1}):`,
          err.message
        );

        if (attempt >= MAX_RETRIES - 1) {
          // Use partial data if we already have some months
          if (Object.keys(allTimes).length > 0) {
            console.warn(
              "✅ Returning partial cached months due to API failure."
            );
            const partialCache: CalendarCache = {
              settingsKey: settingsToKey(settings),
              year,
              data: allTimes,
            };
            cachedCalendars[year] = partialCache;
            await saveToStorage(year, partialCache);
            return partialCache;
          }
          throw new Error(
            "Failed to fetch after multiple attempts. Please try later."
          );
        }

        // exponential backoff before retry
        await new Promise((r) =>
          setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, attempt))
        );
        attempt++;
      }
    }
  }

  const cache: CalendarCache = {
    settingsKey: settingsToKey(settings),
    year,
    data: allTimes,
  };

  cachedCalendars[year] = cache;
  await saveToStorage(year, cache);
  return cache;
}

export async function getPrayerTimesForDate(
  settings: PrayerSettings,
  date: Date
): Promise<PrayerTime[]> {
  const year = date.getFullYear();
  const isoKey = date.toISOString().split("T")[0];
  const settingsKey = settingsToKey(settings);

  // 1. In-memory
  if (
    cachedCalendars[year] &&
    cachedCalendars[year].settingsKey === settingsKey
  ) {
    return cachedCalendars[year].data[isoKey] || [];
  }

  // 2. AsyncStorage
  const stored = await loadFromStorage(year, settingsKey);
  if (stored && stored.settingsKey === settingsKey) {
    cachedCalendars[year] = stored;
    return stored.data[isoKey] || [];
  }

  // 3. API
  const fresh = await fetchYearCalendar(year, settings);
  return fresh.data[isoKey] || [];
}

export async function clearPrayerCache() {
  cachedCalendars = {};
}
