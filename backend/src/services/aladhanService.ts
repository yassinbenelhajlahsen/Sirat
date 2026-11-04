import {
  AladhanServiceError,
  createCachedGetter,
  logEvent,
  requestAladhan,
  type CacheStatus,
  type ServiceResponse,
} from "./aladhanFetch.js";

export { AladhanServiceError };
export type { CacheStatus, ServiceResponse } from "./aladhanFetch.js";

const REQUIRED_PRAYER_KEYS = [
  "Fajr",
  "Sunrise",
  "Dhuhr",
  "Asr",
  "Maghrib",
  "Isha",
] as const;
const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const GREGORIAN_DDMMYYYY_REGEX = /^([0-2]\d|3[01])-(0\d|1[0-2])-(\d{4})$/;
const TIMINGS_CACHE_TTL_MS = 5 * 60 * 1000;
const CALENDAR_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const HOLIDAYS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HOLIDAY_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const CALENDAR_YEAR_CONCURRENCY = 3;

type PrayerKey = (typeof REQUIRED_PRAYER_KEYS)[number];

type PrayerTimesParams = {
  latitude: number;
  longitude: number;
  method: number;
};

type CalendarParams = PrayerTimesParams & {
  month: number;
  year: number;
};

type CalendarYearParams = PrayerTimesParams & {
  year: number;
};

type PrayerTimings = Record<PrayerKey, string>;

type TimingsPayload = {
  timings: PrayerTimings;
};

export type Holiday = {
  date: string;
  name: string;
};

export type HolidaysPayload = {
  holidays: Holiday[];
};

type CalendarEntry = {
  date: {
    gregorian: {
      date: string;
    };
  };
  timings: PrayerTimings;
};

export type CalendarYearPayload = {
  days: CalendarEntry[];
  partial: boolean;
  fetchedMonths: number[];
  failedMonths: number[];
  staleMonths: number[];
  cacheByMonth: Record<string, CacheStatus>;
};

function coordinateBucket(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

function timingsCacheKey(params: PrayerTimesParams): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${coordinateBucket(params.latitude, params.longitude)}:${params.method}:${day}`;
}

function calendarCacheKey(params: CalendarParams): string {
  return `${coordinateBucket(params.latitude, params.longitude)}:${params.method}:${params.month}:${params.year}`;
}

function calendarYearCacheKey(params: CalendarYearParams): string {
  return `${coordinateBucket(params.latitude, params.longitude)}:${params.method}:${params.year}`;
}

function holidaysCacheKey(year: number): string {
  return `${year}`;
}

function normalizeTimingValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const firstToken = value.trim().split(" ")[0];
  if (!HHMM_REGEX.test(firstToken)) {
    return null;
  }
  return firstToken;
}

function sanitizeTimings(raw: unknown): PrayerTimings {
  if (!raw || typeof raw !== "object") {
    throw new AladhanServiceError(
      "Aladhan returned malformed timings payload.",
      "INVALID_RESPONSE",
      502,
      false,
    );
  }

  const timings = raw as Record<string, unknown>;
  const validated = {} as PrayerTimings;

  REQUIRED_PRAYER_KEYS.forEach((key) => {
    const normalized = normalizeTimingValue(timings[key]);
    if (!normalized) {
      throw new AladhanServiceError(
        `Aladhan timings are invalid for ${key}.`,
        "INVALID_RESPONSE",
        502,
        false,
      );
    }
    validated[key] = normalized;
  });

  return validated;
}

function sanitizeTimingsPayload(rawData: unknown): TimingsPayload {
  if (!rawData || typeof rawData !== "object") {
    throw new AladhanServiceError(
      "Aladhan timings response is invalid.",
      "INVALID_RESPONSE",
      502,
      false,
    );
  }

  const data = rawData as { timings?: unknown };
  return {
    timings: sanitizeTimings(data.timings),
  };
}

function sanitizeCalendarPayload(rawData: unknown): CalendarEntry[] {
  if (!Array.isArray(rawData)) {
    throw new AladhanServiceError(
      "Aladhan calendar response is invalid.",
      "INVALID_RESPONSE",
      502,
      false,
    );
  }

  return rawData.map((day, index) => {
    if (!day || typeof day !== "object") {
      throw new AladhanServiceError(
        `Aladhan calendar day ${index + 1} is malformed.`,
        "INVALID_RESPONSE",
        502,
        false,
      );
    }

    const typedDay = day as {
      date?: {
        gregorian?: {
          date?: unknown;
        };
      };
      timings?: unknown;
    };

    const gregorianDate = typedDay.date?.gregorian?.date;
    if (typeof gregorianDate !== "string") {
      throw new AladhanServiceError(
        `Aladhan calendar day ${index + 1} is missing gregorian.date.`,
        "INVALID_RESPONSE",
        502,
        false,
      );
    }

    return {
      date: {
        gregorian: {
          date: gregorianDate,
        },
      },
      timings: sanitizeTimings(typedDay.timings),
    };
  });
}

function normalizeGregorianDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  const match = GREGORIAN_DDMMYYYY_REGEX.exec(trimmed);
  if (!match) {
    return null;
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);

  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValidDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;

  if (!isValidDate) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sanitizeHolidayMonthPayload(rawData: unknown): Holiday[] {
  if (!Array.isArray(rawData)) {
    throw new AladhanServiceError(
      "Aladhan holiday response is invalid.",
      "INVALID_RESPONSE",
      502,
      false,
    );
  }

  const collected: Holiday[] = [];

  rawData.forEach((day) => {
    if (!day || typeof day !== "object") {
      return;
    }

    const typedDay = day as {
      gregorian?: {
        date?: unknown;
      };
      hijri?: {
        holidays?: unknown;
      };
    };

    const date = normalizeGregorianDate(typedDay.gregorian?.date);
    if (!date) {
      return;
    }

    const holidays = typedDay.hijri?.holidays;
    if (!Array.isArray(holidays)) {
      return;
    }

    holidays.forEach((name) => {
      if (typeof name !== "string") {
        return;
      }
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }
      collected.push({
        date,
        name: trimmed,
      });
    });
  });

  return collected;
}

function dedupeHolidaysByDate(holidays: Holiday[]): Holiday[] {
  const byDate = new Map<string, string>();

  holidays.forEach((holiday) => {
    if (!byDate.has(holiday.date)) {
      byDate.set(holiday.date, holiday.name);
    }
  });

  return Array.from(byDate.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, name]) => ({ date, name }));
}

async function fetchFreshTimings(params: PrayerTimesParams): Promise<TimingsPayload> {
  const upstreamData = await requestAladhan<unknown>({
    endpoint: "timings",
    path: "timings",
    params,
  });
  return sanitizeTimingsPayload(upstreamData);
}

async function fetchFreshCalendar(params: CalendarParams): Promise<CalendarEntry[]> {
  const upstreamData = await requestAladhan<unknown>({
    endpoint: "calendar",
    path: "calendar",
    params,
  });
  return sanitizeCalendarPayload(upstreamData);
}

function aggregateMonthCacheStatus(statuses: CacheStatus[]): CacheStatus {
  if (statuses.length === 0) {
    return "miss";
  }
  if (statuses.every((status) => status === "hit")) {
    return "hit";
  }
  if (statuses.some((status) => status === "stale")) {
    return "stale";
  }
  return "miss";
}

async function fetchFreshCalendarYear(
  params: CalendarYearParams,
): Promise<CalendarYearPayload> {
  const monthResults: Array<
    | {
        month: number;
        success: true;
        response: ServiceResponse<CalendarEntry[]>;
      }
    | {
        month: number;
        success: false;
        error: unknown;
      }
  > = [];

  for (let i = 0; i < HOLIDAY_MONTHS.length; i += CALENDAR_YEAR_CONCURRENCY) {
    const monthBatch = HOLIDAY_MONTHS.slice(i, i + CALENDAR_YEAR_CONCURRENCY);
    const batchResults = await Promise.all(
      monthBatch.map(async (month) => {
        try {
          const response = await getCalendar({
            latitude: params.latitude,
            longitude: params.longitude,
            method: params.method,
            month,
            year: params.year,
          });
          return {
            month,
            success: true as const,
            response,
          };
        } catch (error: unknown) {
          return {
            month,
            success: false as const,
            error,
          };
        }
      }),
    );

    monthResults.push(...batchResults);
  }

  const successful = monthResults.filter((result) => result.success);
  if (successful.length === 0) {
    const firstFailure = monthResults.find((result) => !result.success);
    throw (
      firstFailure?.error ??
      new AladhanServiceError(
        "Failed to fetch prayer calendar year from Aladhan.",
        "UPSTREAM_SERVER_ERROR",
        502,
        true,
      )
    );
  }

  const failedMonths = monthResults
    .filter((result) => !result.success)
    .map((result) => result.month);
  const fetchedMonths = successful.map((result) => result.month);
  const staleMonths = successful
    .filter((result) => result.response.stale)
    .map((result) => result.month);
  const cacheByMonth = successful.reduce<Record<string, CacheStatus>>(
    (acc, result) => {
      acc[String(result.month)] = result.response.cacheStatus;
      return acc;
    },
    {},
  );

  if (failedMonths.length > 0) {
    logEvent("aladhan_failure", {
      endpoint: "calendar-year",
      params: {
        year: params.year,
        latitude: params.latitude,
        longitude: params.longitude,
        method: params.method,
      },
      errorType: "PARTIAL_MONTH_FAILURE",
      fetchedMonths,
      failedMonths,
      staleServed: staleMonths.length > 0,
    });
  }

  return {
    days: successful.flatMap((result) => result.response.data),
    partial: failedMonths.length > 0,
    fetchedMonths,
    failedMonths,
    staleMonths,
    cacheByMonth,
  };
}

async function fetchHolidayMonth(year: number, month: number): Promise<Holiday[]> {
  const upstreamData = await requestAladhan<unknown>({
    endpoint: "holidays",
    path: `gToHCalendar/${month}/${year}`,
    logParams: {
      year,
      month,
    },
  });

  return sanitizeHolidayMonthPayload(upstreamData);
}

async function fetchFreshHolidays(year: number): Promise<HolidaysPayload> {
  const monthResults = await Promise.all(
    HOLIDAY_MONTHS.map(async (month) => {
      try {
        const holidays = await fetchHolidayMonth(year, month);
        return {
          month,
          holidays,
          success: true as const,
        };
      } catch (error: unknown) {
        logEvent("aladhan_failure", {
          endpoint: "holidays",
          params: { year, month },
          errorType:
            error instanceof AladhanServiceError ? error.code : "UNKNOWN_ERROR",
          staleServed: false,
        });

        return {
          month,
          holidays: [] as Holiday[],
          success: false as const,
          error,
        };
      }
    }),
  );

  const fetchedMonths = monthResults.filter((result) => result.success).length;
  if (fetchedMonths === 0) {
    const firstFailure = monthResults.find((result) => !result.success);
    throw (
      firstFailure?.error ??
      new AladhanServiceError(
        "Failed to fetch holidays from Aladhan.",
        "UPSTREAM_SERVER_ERROR",
        502,
        true,
      )
    );
  }

  if (fetchedMonths < HOLIDAY_MONTHS.length) {
    logEvent("aladhan_failure", {
      endpoint: "holidays",
      params: { year },
      errorType: "PARTIAL_MONTH_FAILURE",
      fetchedMonths,
      totalMonths: HOLIDAY_MONTHS.length,
      failedMonths: monthResults
        .filter((result) => !result.success)
        .map((result) => result.month),
      staleServed: false,
    });
  }

  const deduped = dedupeHolidaysByDate(
    monthResults.flatMap((result) => result.holidays),
  );

  return {
    holidays: deduped,
  };
}

export const getTimings = createCachedGetter({
  endpoint: "timings",
  ttlMs: TIMINGS_CACHE_TTL_MS,
  key: timingsCacheKey,
  fetch: fetchFreshTimings,
});

export const getCalendar = createCachedGetter({
  endpoint: "calendar",
  ttlMs: CALENDAR_CACHE_TTL_MS,
  key: calendarCacheKey,
  fetch: fetchFreshCalendar,
});

export const getCalendarYear = createCachedGetter({
  endpoint: "calendar-year",
  ttlMs: CALENDAR_CACHE_TTL_MS,
  key: calendarYearCacheKey,
  fetch: fetchFreshCalendarYear,
  describe: (payload) => ({
    stale: payload.staleMonths.length > 0,
    cacheStatus: aggregateMonthCacheStatus(Object.values(payload.cacheByMonth)),
  }),
});

export const getHolidays = createCachedGetter({
  endpoint: "holidays",
  ttlMs: HOLIDAYS_CACHE_TTL_MS,
  key: holidaysCacheKey,
  logParams: (year: number) => ({ year }),
  fetch: fetchFreshHolidays,
});
