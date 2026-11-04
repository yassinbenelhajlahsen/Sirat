import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("aladhanFetch", () => {
  const mockAxiosGet: jest.Mock = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.useRealTimers();
    mockAxiosGet.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function load() {
    jest.unstable_mockModule("axios", () => ({ default: { get: mockAxiosGet } }));
    return import("../src/services/aladhanFetch.js");
  }

  describe("createCachedGetter", () => {
    const TTL = 60_000;

    async function makeGetter(fetch: (id: string) => Promise<string>) {
      const { createCachedGetter } = await load();
      return createCachedGetter<string, string>({
        endpoint: "test",
        ttlMs: TTL,
        key: (id) => id,
        fetch,
      });
    }

    it("fetches on a miss, then serves the cached value as a hit", async () => {
      const fetch = jest.fn(async (id: string) => `value-${id}`);
      const get = await makeGetter(fetch as any);

      expect(await get("a")).toEqual({ data: "value-a", stale: false, cacheStatus: "miss" });
      expect(await get("a")).toEqual({ data: "value-a", stale: false, cacheStatus: "hit" });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("keeps separate entries per key", async () => {
      const fetch = jest.fn(async (id: string) => `value-${id}`);
      const get = await makeGetter(fetch as any);

      await get("a");
      expect((await get("b")).cacheStatus).toBe("miss");
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("refetches once the TTL has passed", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
      const fetch = jest.fn(async () => "value");
      const get = await makeGetter(fetch as any);

      await get("a");
      jest.setSystemTime(new Date(Date.now() + TTL - 1));
      expect((await get("a")).cacheStatus).toBe("hit");
      jest.setSystemTime(new Date(Date.now() + 2));
      expect((await get("a")).cacheStatus).toBe("miss");
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("shares one fetch between identical in-flight requests", async () => {
      let resolve: ((value: string) => void) | undefined;
      const fetch = jest.fn(
        () => new Promise<string>((r) => { resolve = r; }),
      );
      const get = await makeGetter(fetch as any);

      const first = get("a");
      const second = get("a");
      expect(fetch).toHaveBeenCalledTimes(1);

      resolve?.("value");
      expect(await first).toEqual({ data: "value", stale: false, cacheStatus: "miss" });
      expect(await second).toEqual({ data: "value", stale: false, cacheStatus: "miss" });
    });

    it("lets a request through again after an in-flight one fails", async () => {
      const fetch = jest.fn<(id: string) => Promise<string>>()
        .mockRejectedValueOnce(new Error("down"))
        .mockResolvedValueOnce("value");
      const get = await makeGetter(fetch);

      await expect(get("a")).rejects.toThrow("down");
      expect((await get("a")).data).toBe("value");
    });

    it("serves the expired value as stale when the refresh fails", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
      // The global setup already spies on console.error; clear what earlier tests logged.
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      consoleError.mockClear();
      const fetch = jest.fn<(id: string) => Promise<string>>()
        .mockResolvedValueOnce("old")
        .mockRejectedValueOnce(new Error("network down"));
      const get = await makeGetter(fetch);

      await get("a");
      jest.setSystemTime(new Date(Date.now() + TTL + 1));

      expect(await get("a")).toEqual({ data: "old", stale: true, cacheStatus: "stale" });
      expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
        event: "aladhan_failure",
        endpoint: "test",
        staleServed: true,
      });
    });

    it("throws when the fetch fails and nothing is cached", async () => {
      // The global setup already spies on console.error; clear what earlier tests logged.
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      consoleError.mockClear();
      const get = await makeGetter(jest.fn(async () => { throw new Error("down"); }) as any);

      await expect(get("a")).rejects.toThrow("down");
      expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
        event: "aladhan_failure",
        errorType: "UNKNOWN_ERROR",
        staleServed: false,
      });
    });

    it("takes the cache status of a fresh result from describe", async () => {
      const { createCachedGetter } = await load();
      const get = createCachedGetter<string, string>({
        endpoint: "test",
        ttlMs: TTL,
        key: (id) => id,
        fetch: async () => "value",
        describe: () => ({ stale: true, cacheStatus: "stale" }),
      });

      expect(await get("a")).toEqual({ data: "value", stale: true, cacheStatus: "stale" });
    });
  });

  describe("requestAladhan", () => {
    const ok = (data: unknown) => ({ status: 200, data: { data } });

    async function request() {
      const { requestAladhan } = await load();
      return requestAladhan<unknown>({ endpoint: "timings", path: "timings", params: { a: 1 } });
    }

    it("returns the data payload", async () => {
      mockAxiosGet.mockResolvedValue(ok({ x: 1 }) as never);
      await expect(request()).resolves.toEqual({ x: 1 });
      expect(mockAxiosGet).toHaveBeenCalledWith(
        "https://api.aladhan.com/v1/timings",
        expect.objectContaining({ params: { a: 1 }, timeout: 10000 }),
      );
    });

    it("retries a 429 and then succeeds", async () => {
      mockAxiosGet
        .mockResolvedValueOnce({ status: 429, data: {} } as never)
        .mockResolvedValueOnce(ok("fine") as never);

      await expect(request()).resolves.toBe("fine");
      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
    });

    it("backs off 300ms then 600ms between retries", async () => {
      jest.useFakeTimers();
      mockAxiosGet
        .mockResolvedValueOnce({ status: 503, data: {} } as never)
        .mockResolvedValueOnce({ status: 503, data: {} } as never)
        .mockResolvedValueOnce(ok("fine") as never);

      const pending = request();
      await jest.advanceTimersByTimeAsync(0);
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(299);
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(599);
      expect(mockAxiosGet).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toBe("fine");
    });

    it("gives up on a 429 after three attempts as a retriable RATE_LIMIT", async () => {
      mockAxiosGet.mockResolvedValue({ status: 429, data: {} } as never);

      await expect(request()).rejects.toMatchObject({ code: "RATE_LIMIT", status: 429, retriable: true });
      expect(mockAxiosGet).toHaveBeenCalledTimes(3);
    });

    it("gives up on a 5xx after three attempts as UPSTREAM_SERVER_ERROR", async () => {
      mockAxiosGet.mockResolvedValue({ status: 500, data: {} } as never);

      await expect(request()).rejects.toMatchObject({
        code: "UPSTREAM_SERVER_ERROR",
        status: 502,
        retriable: true,
      });
      expect(mockAxiosGet).toHaveBeenCalledTimes(3);
    });

    it("does not retry other 4xx", async () => {
      mockAxiosGet.mockResolvedValue({ status: 400, data: {} } as never);

      await expect(request()).rejects.toMatchObject({
        code: "UPSTREAM_BAD_REQUEST",
        status: 502,
        retriable: false,
      });
      expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    });

    it("reports a transport failure as a retriable NETWORK_ERROR", async () => {
      mockAxiosGet.mockRejectedValue(new Error("socket hang up") as never);

      await expect(request()).rejects.toMatchObject({ code: "NETWORK_ERROR", status: 502, retriable: true });
    });

    it("rejects a success response without a data payload", async () => {
      mockAxiosGet.mockResolvedValue({ status: 200, data: {} } as never);

      await expect(request()).rejects.toMatchObject({ code: "INVALID_RESPONSE", status: 502, retriable: false });
    });
  });
});
