// services/prayerTimes.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { City } from "../util/cities";
import { resolveAutoMethod } from "../util/methodResolver";

/* ============================
 * Types
 * ============================ */
export interface PrayerSettings {
  useLocation: boolean; // true = use device location if available
  method: number; // Aladhan calculation method (-1 = Auto)
  city?: City; // manual city fallback or explicit city when useLocation=false
}

export interface PrayerTime {
  label: "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha" | string;
  time: string; // "h:mm AM/PM"
}

/* ============================
 * Internal cache model
 * ============================ */
type CalendarCache = {
  cacheKey: string; // year + settingsKey (incl. bucket)
  year: number;
  data: Record<string, PrayerTime[]>; // keyed by "YYYY-MM-DD"
};

// In-memory caches keyed by our composite cacheKey
let memoryCalendars: Record<string, CalendarCache> = {};

/* ============================
 * Helpers
 * ============================ */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTo12Hour(time24: string): string {
  // Aladhan sometimes returns "05:23 (EDT)" or "05:23 +05:00"
  const clean = time24.split(" ")[0]; // drop any zone or offset
  const [hStr, mStr] = clean.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function settingsToKey(settings: PrayerSettings) {
  return JSON.stringify({
    useLocation: settings.useLocation,
    method: settings.method,
    city: settings.city?.name || "",
  });
}

function coordBucket(lat: number, lng: number) {
  // ~1–2 km precision buckets so moving cities invalidates cached calendar
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function makeCacheKey(
  year: number,
  settingsKey: string,
  bucket: string | null
): string {
  return `${year}::${settingsKey}${bucket ? `::${bucket}` : ""}`;
}

function storageKeyFor(cacheKey: string) {
  return `prayerCalendar-${cacheKey}`;
}

/* ============================
 * Coords / Country resolution
 * ============================ */
type ResolvedEnv = {
  latitude: number;
  longitude: number;
  country: string; // country name or ISO code if available, else ""
  bucket: string; // coord bucket for cache-keying
};

async function resolveCoordsAndCountry(
  settings: PrayerSettings,
  override?: {
    coords?: { latitude: number; longitude: number };
    country?: string;
  }
): Promise<ResolvedEnv> {
  // If override coords are provided (e.g., Home already resolved once), use them
  if (override?.coords) {
    const { latitude, longitude } = override.coords;
    const bucket = coordBucket(latitude, longitude);
    return {
      latitude,
      longitude,
      bucket,
      country: override.country ?? "",
    };
  }

  if (!settings.useLocation) {
    if (!settings.city)
      throw new Error("City must be provided when location is disabled");
    const { lat, lng, country } = settings.city;
    return {
      latitude: lat,
      longitude: lng,
      country: country || "",
      bucket: coordBucket(lat, lng),
    };
  }

  // Location path
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  let perm = await Location.getForegroundPermissionsAsync();

  if (!servicesEnabled || perm.status !== "granted") {
    try {
      if (perm.status !== "granted") {
        perm = await Location.requestForegroundPermissionsAsync();
      }
    } catch {}
  }

  if (servicesEnabled && perm.status === "granted") {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    let country = "";
    try {
      const geo = await Location.reverseGeocodeAsync(loc.coords);
      if (geo.length > 0) {
        country =
          (geo[0].country as string) ||
          (geo[0].isoCountryCode as string) ||
          "";
      }
    } catch {}
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      country,
      bucket: coordBucket(loc.coords.latitude, loc.coords.longitude),
    };
  }

  // Fallback to manual when location fails
  if (settings.city) {
    const { lat, lng, country } = settings.city;
    return {
      latitude: lat,
      longitude: lng,
      country: country || "",
      bucket: coordBucket(lat, lng),
    };
  }

  throw new Error(
    "Location unavailable. Enable Location Services or set a manual city in Settings."
  );
}

/* ============================
 * Storage helpers
 * ============================ */
async function saveToStorage(cache: CalendarCache) {
  try {
    await AsyncStorage.setItem(storageKeyFor(cache.cacheKey), JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to save prayer calendar:", e);
  }
}

async function loadFromStorage(cacheKey: string): Promise<CalendarCache | null> {
  try {
    const val = await AsyncStorage.getItem(storageKeyFor(cacheKey));
    if (!val) return null;
    return JSON.parse(val);
  } catch (e) {
    console.warn("Failed to load prayer calendar:", e);
    return null;
  }
}

/* ============================
 * Fast path (today only)
 * ============================ */
async function getPrayerTimesFastToday(
  settings: PrayerSettings,
  env: ResolvedEnv
): Promise<PrayerTime[]> {
  let method = settings.method;
  if (method === -1) method = resolveAutoMethod(env.country);

  const url = `https://api.aladhan.com/v1/timings?latitude=${env.latitude}&longitude=${env.longitude}&method=${method}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch timings: ${r.status}`);
  const j = await r.json();
  const t = j?.data?.timings;
  if (!t) throw new Error("Invalid response from API");

  return [
    { label: "Fajr", time: formatTo12Hour(t.Fajr) },
    { label: "Sunrise", time: formatTo12Hour(t.Sunrise) },
    { label: "Dhuhr", time: formatTo12Hour(t.Dhuhr) },
    { label: "Asr", time: formatTo12Hour(t.Asr) },
    { label: "Maghrib", time: formatTo12Hour(t.Maghrib) },
    { label: "Isha", time: formatTo12Hour(t.Isha) },
  ];
}

/* ============================
 * Full-year calendar fetch
 * ============================ */
async function fetchYearCalendar(
  year: number,
  settings: PrayerSettings,
  env: ResolvedEnv
): Promise<CalendarCache> {
  let method = settings.method;
  if (method === -1) method = resolveAutoMethod(env.country);

  const MAX_RETRIES = 3;
  const BACKOFF_BASE_MS = 2000;

  const allTimes: Record<string, PrayerTime[]> = {};

  for (let month = 1; month <= 12; month++) {
    let attempt = 0;
    let success = false;

    while (attempt < MAX_RETRIES && !success) {
      try {
        const url = `https://api.aladhan.com/v1/calendar?latitude=${env.latitude}&longitude=${env.longitude}&method=${method}&month=${month}&year=${year}`;
        const res = await fetch(url);

        if (!res.ok) {
          if (res.status === 429) {
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
          // API gives "dd-mm-yyyy"
          const greg = day?.date?.gregorian?.date as string;
          if (!greg) return;
          const [dd, mm, yy] = greg
            .split("-")
            .map((x: string) => parseInt(x, 10));
          const key = `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

          allTimes[key] = [
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
        if (attempt >= MAX_RETRIES - 1) {
          if (Object.keys(allTimes).length > 0) {
            // Return partial cache (better than failing outright)
            const settingsKey = settingsToKey(settings);
            const cacheKey = makeCacheKey(year, settingsKey, env.bucket);
            const partial: CalendarCache = {
              cacheKey,
              year,
              data: allTimes,
            };
            memoryCalendars[cacheKey] = partial;
            await saveToStorage(partial);
            return partial;
          }
          throw new Error("Failed to fetch calendar after multiple attempts.");
        }
        await new Promise((r) =>
          setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, attempt))
        );
        attempt++;
      }
    }
  }

  const settingsKey = settingsToKey(settings);
  const cacheKey = makeCacheKey(year, settingsKey, env.bucket);
  const cache: CalendarCache = {
    cacheKey,
    year,
    data: allTimes,
  };
  memoryCalendars[cacheKey] = cache;
  await saveToStorage(cache);
  return cache;
}

/* ============================
 * Public API
 * ============================ */

/**
 * Get prayer times for a specific date using year calendar cache.
 * Fast-path today: returns immediately with /timings, then prefetches the year in the background.
 */
export async function getPrayerTimesForDate(
  settings: PrayerSettings,
  date: Date
): Promise<PrayerTime[]> {
  const year = date.getFullYear();
  const isoKey = dateKey(date);

  // Resolve environment (coords + country + bucket)
  const env = await resolveCoordsAndCountry(settings);

  // Compose keys
  const settingsKey = settingsToKey(settings);
  const cacheKey = makeCacheKey(year, settingsKey, env.bucket);

  // 1) In-memory
  const mem = memoryCalendars[cacheKey];
  if (mem) {
    return mem.data[isoKey] || [];
  }

  // 2) AsyncStorage
  const stored = await loadFromStorage(cacheKey);
  if (stored) {
    memoryCalendars[cacheKey] = stored;
    return stored.data[isoKey] || [];
  }

  // 3) No cache yet — fast path for *today only*
  const isToday =
    date.toDateString() === new Date().toDateString();

  if (isToday) {
    try {
      const fast = await getPrayerTimesFastToday(settings, env);
      // Fire-and-forget prefetch of the full calendar
      fetchYearCalendar(year, settings, env).catch(() => {});
      return fast;
    } catch {
      // Fall back to calendar fetch if fast path fails
    }
  }

  // 4) Full calendar fetch
  const fresh = await fetchYearCalendar(year, settings, env);
  return fresh.data[isoKey] || [];
}

/**
 * Get prayer times for today.
 * Accepts optional override { coords, country } to reuse a single resolved location.
 */
export async function getPrayerTimesToday(
  settings: PrayerSettings,
  opts?: {
    coords?: { latitude: number; longitude: number };
    country?: string;
  }
): Promise<PrayerTime[]> {
  const today = new Date();
  // If we were given coords, use them for the fast path & cache keys
  if (opts?.coords || opts?.country) {
    const env = await resolveCoordsAndCountry(settings, {
      coords: opts.coords,
      country: opts.country,
    });

    const year = today.getFullYear();
    const isoKey = dateKey(today);
    const settingsKey = settingsToKey(settings);
    const cacheKey = makeCacheKey(year, settingsKey, env.bucket);

    // Try memory/storage first to avoid unnecessary network
    const mem = memoryCalendars[cacheKey];
    if (mem?.data?.[isoKey]) return mem.data[isoKey];

    const stored = await loadFromStorage(cacheKey);
    if (stored?.data?.[isoKey]) {
      memoryCalendars[cacheKey] = stored;
      return stored.data[isoKey];
    }

    // Otherwise fast fetch today, and seed the calendar in background
    const fast = await getPrayerTimesFastToday(settings, env);
    fetchYearCalendar(year, settings, env).catch(() => {});
    return fast;
  }

  // Default path — rely on the generic function (includes fast path logic)
  return getPrayerTimesForDate(settings, today);
}

/**
 * Alias used by the scheduler for arbitrary days (kept for backward compat).
 * Note the argument order matches your older code: (date, settings).
 */
export async function getPrayerTimesOn(
  date: Date,
  settings: PrayerSettings
): Promise<PrayerTime[]> {
  return getPrayerTimesForDate(settings, date);
}

/**
 * Clear in-memory calendar cache.
 * Note: This does NOT purge AsyncStorage (same behavior as your original code).
 */
export async function clearPrayerCache() {
  memoryCalendars = {};
}
