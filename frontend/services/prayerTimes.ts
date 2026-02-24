import {
  buildPrayerCacheKey,
  clearPrayerMemoryCache,
  loadPrayerStorageCache,
  readPrayerMemoryCache,
  savePrayerStorageCache,
  writePrayerMemoryCache,
} from "./prayer-times/cacheStore";
import { resolveCoordsAndCountry } from "./prayer-times/environment";
import { fetchPrayerProxy } from "./prayer-times/apiClient";
import {
  dateKey,
  formatTo12Hour,
  mapTimingsToPrayerTimes,
  mergeCalendarDayIntoStore,
} from "./prayer-times/transformers";
import type {
  BackendCalendarDay,
  BackendCalendarYearPayload,
  BackendTimingsPayload,
  CalendarCache,
  PrayerLocationOverride,
  PrayerMethodParam,
  PrayerSettings,
  PrayerTime,
  ResolvedEnv,
} from "./prayer-times/types";

export type {
  PrayerSettings,
  PrayerTime,
  PrayerMethodParam,
  ResolvedEnv,
} from "./prayer-times/types";
export { formatTo12Hour };

async function fetchYearCalendarLegacy(
  year: number,
  method: PrayerMethodParam,
  env: ResolvedEnv,
): Promise<Record<string, PrayerTime[]>> {
  const allTimes: Record<string, PrayerTime[]> = {};

  for (let month = 1; month <= 12; month++) {
    const params: Record<string, string | number> = {
      latitude: env.latitude,
      longitude: env.longitude,
      method,
      month,
      year,
    };

    if (method === "auto" && env.country) {
      params.country = env.country;
    }

    try {
      const days = await fetchPrayerProxy<BackendCalendarDay[]>(
        "/api/prayer-times/calendar",
        params,
      );

      days.forEach((day) => {
        mergeCalendarDayIntoStore(allTimes, day);
      });
    } catch {
      if (Object.keys(allTimes).length > 0) {
        return allTimes;
      }
      throw new Error("Failed to fetch calendar from prayer times API.");
    }
  }

  return allTimes;
}

async function getPrayerTimesFastToday(
  settings: PrayerSettings,
  env: ResolvedEnv,
): Promise<PrayerTime[]> {
  const method: PrayerMethodParam =
    settings.method === -1 ? "auto" : settings.method;

  const params: Record<string, string | number> = {
    latitude: env.latitude,
    longitude: env.longitude,
    method,
  };

  if (method === "auto" && env.country) {
    params.country = env.country;
  }

  const data = await fetchPrayerProxy<BackendTimingsPayload>(
    "/api/prayer-times/timings",
    params,
  );

  const timings = data?.timings;
  if (!timings) {
    throw new Error("Invalid response from API");
  }

  return mapTimingsToPrayerTimes(timings);
}

async function fetchYearCalendar(
  year: number,
  settings: PrayerSettings,
  env: ResolvedEnv,
): Promise<CalendarCache> {
  const method: PrayerMethodParam =
    settings.method === -1 ? "auto" : settings.method;

  let allTimes: Record<string, PrayerTime[]> = {};

  try {
    const params: Record<string, string | number> = {
      latitude: env.latitude,
      longitude: env.longitude,
      method,
      year,
    };

    if (method === "auto" && env.country) {
      params.country = env.country;
    }

    const yearPayload = await fetchPrayerProxy<BackendCalendarYearPayload>(
      "/api/prayer-times/calendar/year",
      params,
    );

    const days = Array.isArray(yearPayload?.days) ? yearPayload.days : [];
    days.forEach((day) => {
      mergeCalendarDayIntoStore(allTimes, day);
    });

    if (Object.keys(allTimes).length === 0) {
      throw new Error("Invalid yearly calendar payload");
    }
  } catch {
    allTimes = await fetchYearCalendarLegacy(year, method, env);
  }

  const { cacheKey } = buildPrayerCacheKey({
    year,
    settings,
    bucket: env.bucket,
  });

  const cache: CalendarCache = {
    cacheKey,
    year,
    data: allTimes,
  };

  writePrayerMemoryCache(cache);
  await savePrayerStorageCache(cache);
  return cache;
}

export async function getPrayerTimesForDate(
  settings: PrayerSettings,
  date: Date,
): Promise<PrayerTime[]> {
  const year = date.getFullYear();
  const isoKey = dateKey(date);

  const env = await resolveCoordsAndCountry(settings);
  const { cacheKey } = buildPrayerCacheKey({
    year,
    settings,
    bucket: env.bucket,
  });

  const mem = readPrayerMemoryCache(cacheKey);
  if (mem) {
    return mem.data[isoKey] || [];
  }

  const stored = await loadPrayerStorageCache(cacheKey);
  if (stored) {
    writePrayerMemoryCache(stored);
    return stored.data[isoKey] || [];
  }

  const isToday = date.toDateString() === new Date().toDateString();

  if (isToday) {
    try {
      const fast = await getPrayerTimesFastToday(settings, env);
      fetchYearCalendar(year, settings, env).catch(() => {});
      return fast;
    } catch {
      // fall back to yearly fetch
    }
  }

  const fresh = await fetchYearCalendar(year, settings, env);
  return fresh.data[isoKey] || [];
}

export async function getPrayerTimesToday(
  settings: PrayerSettings,
  opts?: PrayerLocationOverride,
): Promise<PrayerTime[]> {
  const today = new Date();

  if (opts?.coords || opts?.country) {
    const env = await resolveCoordsAndCountry(settings, {
      coords: opts.coords,
      country: opts.country,
    });

    const year = today.getFullYear();
    const isoKey = dateKey(today);
    const { cacheKey } = buildPrayerCacheKey({
      year,
      settings,
      bucket: env.bucket,
    });

    const mem = readPrayerMemoryCache(cacheKey);
    if (mem?.data?.[isoKey]) {
      return mem.data[isoKey];
    }

    const stored = await loadPrayerStorageCache(cacheKey);
    if (stored?.data?.[isoKey]) {
      writePrayerMemoryCache(stored);
      return stored.data[isoKey];
    }

    const fast = await getPrayerTimesFastToday(settings, env);
    fetchYearCalendar(year, settings, env).catch(() => {});
    return fast;
  }

  return getPrayerTimesForDate(settings, today);
}

export async function getPrayerTimesOn(
  date: Date,
  settings: PrayerSettings,
): Promise<PrayerTime[]> {
  return getPrayerTimesForDate(settings, date);
}

export async function clearPrayerCache() {
  clearPrayerMemoryCache();
}
