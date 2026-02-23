import axios from "axios";

const ALADHAN_BASE_URL = "https://api.aladhan.com/v1";
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
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
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;
const HOLIDAY_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

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

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type CacheStatus = "hit" | "miss" | "stale";

export type ServiceResponse<T> = {
  data: T;
  stale: boolean;
  cacheStatus: CacheStatus;
};

type ErrorCode =
  | "RATE_LIMIT"
  | "UPSTREAM_SERVER_ERROR"
  | "UPSTREAM_BAD_REQUEST"
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR";

export class AladhanServiceError extends Error {
  status: number;
  code: ErrorCode;
  retriable: boolean;

  constructor(message: string, code: ErrorCode, status: number, retriable: boolean) {
    super(message);
    this.name = "AladhanServiceError";
    this.code = code;
    this.status = status;
    this.retriable = retriable;
  }
}

const timingsCache = new Map<string, CacheEntry<TimingsPayload>>();
const calendarCache = new Map<string, CacheEntry<CalendarEntry[]>>();
const holidaysCache = new Map<string, CacheEntry<HolidaysPayload>>();
const timingsInFlight = new Map<string, Promise<ServiceResponse<TimingsPayload>>>();
const calendarInFlight = new Map<string, Promise<ServiceResponse<CalendarEntry[]>>>();
const holidaysInFlight = new Map<string, Promise<ServiceResponse<HolidaysPayload>>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function logEvent(event: string, data: Record<string, unknown>) {
  if (event !== "aladhan_failure") {
    return;
  }

  console.error(
    JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      ...data,
    }),
  );
}

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

function holidaysCacheKey(year: number): string {
  return `${year}`;
}

function getFreshCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
): CacheEntry<T> | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt > Date.now()) {
    return entry;
  }
  return null;
}

function getStaleCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
): CacheEntry<T> | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  return entry;
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

type AladhanEndpoint = "timings" | "calendar" | "holidays";

type RequestAladhanOptions = {
  endpoint: AladhanEndpoint;
  path: string;
  params?: Record<string, string | number>;
  logParams?: Record<string, string | number>;
};

async function requestAladhan<T>(
  options: RequestAladhanOptions,
): Promise<T> {
  const requestParams = options.params;
  const logParams = options.logParams ?? requestParams ?? {};

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    const start = Date.now();
    logEvent("aladhan_request", {
      endpoint: options.endpoint,
      params: logParams,
    });

    try {
      const response = await axios.get(`${ALADHAN_BASE_URL}/${options.path}`, {
        params: requestParams,
        timeout: 10000,
        validateStatus: () => true,
      });
      const responseTimeMs = Date.now() - start;

      logEvent("aladhan_response", {
        endpoint: options.endpoint,
        params: logParams,
        status: response.status,
        responseTimeMs,
      });

      if (response.status >= 200 && response.status < 300) {
        const payload = response.data as { data?: T } | null;
        if (
          !payload ||
          !Object.prototype.hasOwnProperty.call(payload, "data")
        ) {
          throw new AladhanServiceError(
            "Aladhan response missing data payload.",
            "INVALID_RESPONSE",
            502,
            false,
          );
        }
        return payload.data as T;
      }

      const isRetryableStatus = RETRYABLE_STATUS_CODES.has(response.status);
      if (isRetryableStatus && attempt < MAX_RETRY_ATTEMPTS) {
        const retryDelay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        logEvent("aladhan_retry", {
          endpoint: options.endpoint,
          params: logParams,
          attempt,
          retryDelayMs: retryDelay,
          reason: `HTTP_${response.status}`,
        });
        await sleep(retryDelay);
        continue;
      }

      if (response.status === 429) {
        throw new AladhanServiceError(
          "Aladhan rate limit reached.",
          "RATE_LIMIT",
          429,
          true,
        );
      }

      if (response.status >= 500) {
        throw new AladhanServiceError(
          "Aladhan service is temporarily unavailable.",
          "UPSTREAM_SERVER_ERROR",
          502,
          true,
        );
      }

      throw new AladhanServiceError(
        "Aladhan rejected request parameters.",
        "UPSTREAM_BAD_REQUEST",
        502,
        false,
      );
    } catch (error: unknown) {
      if (error instanceof AladhanServiceError) {
        throw error;
      }

      const responseTimeMs = Date.now() - start;
      logEvent("aladhan_response", {
        endpoint: options.endpoint,
        params: logParams,
        status: "NETWORK_ERROR",
        responseTimeMs,
      });

      const message = error instanceof Error ? error.message : "Unknown error";
      throw new AladhanServiceError(
        `Failed to reach Aladhan: ${message}`,
        "NETWORK_ERROR",
        502,
        true,
      );
    }
  }

  throw new AladhanServiceError(
    "Failed to fetch data from Aladhan after retries.",
    "UPSTREAM_SERVER_ERROR",
    502,
    true,
  );
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

export async function getTimings(
  params: PrayerTimesParams,
): Promise<ServiceResponse<TimingsPayload>> {
  const key = timingsCacheKey(params);
  const fresh = getFreshCache(timingsCache, key);
  if (fresh) {
    logEvent("aladhan_cache_hit", {
      endpoint: "timings",
      key,
    });
    return {
      data: fresh.value,
      stale: false,
      cacheStatus: "hit",
    };
  }

  logEvent("aladhan_cache_miss", {
    endpoint: "timings",
    key,
  });

  const existingRequest = timingsInFlight.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  const stale = getStaleCache(timingsCache, key);

  const requestPromise = (async (): Promise<ServiceResponse<TimingsPayload>> => {
    try {
      const freshData = await fetchFreshTimings(params);
      timingsCache.set(key, {
        value: freshData,
        expiresAt: Date.now() + TIMINGS_CACHE_TTL_MS,
      });
      return {
        data: freshData,
        stale: false,
        cacheStatus: "miss",
      };
    } catch (error: unknown) {
      if (stale) {
        logEvent("aladhan_failure", {
          endpoint: "timings",
          params,
          errorType:
            error instanceof AladhanServiceError ? error.code : "UNKNOWN_ERROR",
          staleServed: true,
        });
        return {
          data: stale.value,
          stale: true,
          cacheStatus: "stale",
        };
      }

      logEvent("aladhan_failure", {
        endpoint: "timings",
        params,
        errorType:
          error instanceof AladhanServiceError ? error.code : "UNKNOWN_ERROR",
        staleServed: false,
      });
      throw error;
    } finally {
      timingsInFlight.delete(key);
    }
  })();

  timingsInFlight.set(key, requestPromise);
  return requestPromise;
}

export async function getCalendar(
  params: CalendarParams,
): Promise<ServiceResponse<CalendarEntry[]>> {
  const key = calendarCacheKey(params);
  const fresh = getFreshCache(calendarCache, key);
  if (fresh) {
    logEvent("aladhan_cache_hit", {
      endpoint: "calendar",
      key,
    });
    return {
      data: fresh.value,
      stale: false,
      cacheStatus: "hit",
    };
  }

  logEvent("aladhan_cache_miss", {
    endpoint: "calendar",
    key,
  });

  const existingRequest = calendarInFlight.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  const stale = getStaleCache(calendarCache, key);

  const requestPromise = (async (): Promise<ServiceResponse<CalendarEntry[]>> => {
    try {
      const freshData = await fetchFreshCalendar(params);
      calendarCache.set(key, {
        value: freshData,
        expiresAt: Date.now() + CALENDAR_CACHE_TTL_MS,
      });
      return {
        data: freshData,
        stale: false,
        cacheStatus: "miss",
      };
    } catch (error: unknown) {
      if (stale) {
        logEvent("aladhan_failure", {
          endpoint: "calendar",
          params,
          errorType:
            error instanceof AladhanServiceError ? error.code : "UNKNOWN_ERROR",
          staleServed: true,
        });
        return {
          data: stale.value,
          stale: true,
          cacheStatus: "stale",
        };
      }

      logEvent("aladhan_failure", {
        endpoint: "calendar",
        params,
        errorType:
          error instanceof AladhanServiceError ? error.code : "UNKNOWN_ERROR",
        staleServed: false,
      });
      throw error;
    } finally {
      calendarInFlight.delete(key);
    }
  })();

  calendarInFlight.set(key, requestPromise);
  return requestPromise;
}

export async function getHolidays(
  year: number,
): Promise<ServiceResponse<HolidaysPayload>> {
  const key = holidaysCacheKey(year);
  const fresh = getFreshCache(holidaysCache, key);
  if (fresh) {
    logEvent("aladhan_cache_hit", {
      endpoint: "holidays",
      key,
    });
    return {
      data: fresh.value,
      stale: false,
      cacheStatus: "hit",
    };
  }

  logEvent("aladhan_cache_miss", {
    endpoint: "holidays",
    key,
  });

  const existingRequest = holidaysInFlight.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  const stale = getStaleCache(holidaysCache, key);

  const requestPromise = (async (): Promise<ServiceResponse<HolidaysPayload>> => {
    try {
      const freshData = await fetchFreshHolidays(year);
      holidaysCache.set(key, {
        value: freshData,
        expiresAt: Date.now() + HOLIDAYS_CACHE_TTL_MS,
      });
      return {
        data: freshData,
        stale: false,
        cacheStatus: "miss",
      };
    } catch (error: unknown) {
      if (stale) {
        logEvent("aladhan_failure", {
          endpoint: "holidays",
          params: { year },
          errorType:
            error instanceof AladhanServiceError ? error.code : "UNKNOWN_ERROR",
          staleServed: true,
        });
        return {
          data: stale.value,
          stale: true,
          cacheStatus: "stale",
        };
      }

      logEvent("aladhan_failure", {
        endpoint: "holidays",
        params: { year },
        errorType:
          error instanceof AladhanServiceError ? error.code : "UNKNOWN_ERROR",
        staleServed: false,
      });
      throw error;
    } finally {
      holidaysInFlight.delete(key);
    }
  })();

  holidaysInFlight.set(key, requestPromise);
  return requestPromise;
}
