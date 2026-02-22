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
const TIMINGS_CACHE_TTL_MS = 5 * 60 * 1000;
const CALENDAR_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;

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
const timingsInFlight = new Map<string, Promise<ServiceResponse<TimingsPayload>>>();
const calendarInFlight = new Map<string, Promise<ServiceResponse<CalendarEntry[]>>>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function logEvent(event: string, data: Record<string, unknown>) {
  console.log(
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

async function requestAladhan<T>(
  endpoint: "timings" | "calendar",
  params: Record<string, string | number>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
    const start = Date.now();
    logEvent("aladhan_request", {
      endpoint,
      params,
    });

    try {
      const response = await axios.get(`${ALADHAN_BASE_URL}/${endpoint}`, {
        params,
        timeout: 10000,
        validateStatus: () => true,
      });
      const responseTimeMs = Date.now() - start;

      logEvent("aladhan_response", {
        endpoint,
        params,
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
          endpoint,
          params,
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
        endpoint,
        params,
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
  const upstreamData = await requestAladhan<unknown>("timings", params);
  return sanitizeTimingsPayload(upstreamData);
}

async function fetchFreshCalendar(params: CalendarParams): Promise<CalendarEntry[]> {
  const upstreamData = await requestAladhan<unknown>("calendar", params);
  return sanitizeCalendarPayload(upstreamData);
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
