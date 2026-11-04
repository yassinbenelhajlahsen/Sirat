import axios from "axios";

const ALADHAN_BASE_URL = "https://api.aladhan.com/v1";
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function logEvent(event: string, data: Record<string, unknown>) {
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

type AladhanEndpoint = "timings" | "calendar" | "holidays";

type RequestAladhanOptions = {
  endpoint: AladhanEndpoint;
  path: string;
  params?: Record<string, string | number>;
  logParams?: Record<string, string | number>;
};

export async function requestAladhan<T>(
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


type CachedGetterOptions<A, T> = {
  endpoint: string;
  ttlMs: number;
  /** Identifies the request: the same key shares one cache entry and one in-flight fetch. */
  key: (arg: A) => string;
  /** What a failure log records about the request. Defaults to the argument itself. */
  logParams?: (arg: A) => unknown;
  fetch: (arg: A) => Promise<T>;
  /** Cache status of a fresh result. Defaults to a plain miss; the year calendar reports its months'. */
  describe?: (value: T) => { stale: boolean; cacheStatus: CacheStatus };
};

/**
 * Wraps a fetch with a fresh cache, de-duplication of identical in-flight requests, and
 * stale-on-error: when a refresh fails, the last value is served (marked stale) instead.
 */
export function createCachedGetter<A, T>(
  options: CachedGetterOptions<A, T>,
): (arg: A) => Promise<ServiceResponse<T>> {
  const cache = new Map<string, { value: T; expiresAt: number }>();
  const inFlight = new Map<string, Promise<ServiceResponse<T>>>();

  return (arg) => {
    const key = options.key(arg);
    const entry = cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      logEvent("aladhan_cache_hit", { endpoint: options.endpoint, key });
      return Promise.resolve({ data: entry.value, stale: false, cacheStatus: "hit" });
    }

    logEvent("aladhan_cache_miss", { endpoint: options.endpoint, key });

    const existing = inFlight.get(key);
    if (existing) {
      return existing;
    }

    const request = (async (): Promise<ServiceResponse<T>> => {
      try {
        const value = await options.fetch(arg);
        cache.set(key, { value, expiresAt: Date.now() + options.ttlMs });
        return {
          data: value,
          ...(options.describe?.(value) ?? { stale: false, cacheStatus: "miss" as const }),
        };
      } catch (error: unknown) {
        // An expired entry is still the last known good value.
        logEvent("aladhan_failure", {
          endpoint: options.endpoint,
          params: options.logParams ? options.logParams(arg) : arg,
          errorType:
            error instanceof AladhanServiceError ? error.code : "UNKNOWN_ERROR",
          staleServed: entry !== undefined,
        });
        if (entry) {
          return { data: entry.value, stale: true, cacheStatus: "stale" };
        }
        throw error;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, request);
    return request;
  };
}
