import AsyncStorage from "@react-native-async-storage/async-storage";

import type { CalendarCache, PrayerSettings } from "./types";

let memoryCalendars: Record<string, CalendarCache> = {};

function settingsToKey(settings: PrayerSettings): string {
  return JSON.stringify({
    useLocation: settings.useLocation,
    method: settings.method,
    city: settings.city?.name || "",
  });
}

function makeCacheKey(
  year: number,
  settingsKey: string,
  bucket: string | null,
): string {
  return `${year}::${settingsKey}${bucket ? `::${bucket}` : ""}`;
}

function storageKeyFor(cacheKey: string): string {
  return `prayerCalendar-${cacheKey}`;
}

export function buildPrayerCacheKey(params: {
  year: number;
  settings: PrayerSettings;
  bucket: string | null;
}) {
  const settingsKey = settingsToKey(params.settings);
  const cacheKey = makeCacheKey(params.year, settingsKey, params.bucket);
  return { settingsKey, cacheKey };
}

export function readPrayerMemoryCache(cacheKey: string): CalendarCache | null {
  return memoryCalendars[cacheKey] ?? null;
}

export function writePrayerMemoryCache(cache: CalendarCache) {
  memoryCalendars[cache.cacheKey] = cache;
}

export async function loadPrayerStorageCache(
  cacheKey: string,
): Promise<CalendarCache | null> {
  try {
    const val = await AsyncStorage.getItem(storageKeyFor(cacheKey));
    if (!val) return null;
    return JSON.parse(val) as CalendarCache;
  } catch (e) {
    console.warn("Failed to load prayer calendar:", e);
    return null;
  }
}

export async function savePrayerStorageCache(cache: CalendarCache) {
  try {
    await AsyncStorage.setItem(storageKeyFor(cache.cacheKey), JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to save prayer calendar:", e);
  }
}

export function clearPrayerMemoryCache() {
  memoryCalendars = {};
}
