import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("aladhanService", () => {
  const mockAxiosGet: jest.Mock = jest.fn();

  const params = {
    latitude: 40.7128,
    longitude: -74.006,
    method: 2,
  };

  const validTimings = {
    Fajr: "05:12",
    Sunrise: "06:34",
    Dhuhr: "12:20",
    Asr: "15:40",
    Maghrib: "18:02",
    Isha: "19:18",
  };

  beforeEach(() => {
    jest.resetModules();
    jest.useRealTimers();
    mockAxiosGet.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function loadService() {
    jest.unstable_mockModule("axios", () => ({
      default: { get: mockAxiosGet },
    }));

    return import("../src/services/aladhanService.js");
  }

  it("returns sanitized timings payload", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      status: 200,
      data: {
        data: {
          timings: {
            Fajr: "05:12 (EST)",
            Sunrise: "06:34 +05:00",
            Dhuhr: "12:20",
            Asr: "15:40",
            Maghrib: "18:02",
            Isha: "19:18",
          },
        },
      },
    });

    const { getTimings } = await loadService();
    const result = await getTimings(params);

    expect(result.stale).toBe(false);
    expect(result.cacheStatus).toBe("miss");
    expect(result.data.timings).toEqual(validTimings);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
  });

  it("throws INVALID_RESPONSE when required prayer keys are malformed", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      status: 200,
      data: {
        data: {
          timings: {
            ...validTimings,
            Asr: "bad-value",
          },
        },
      },
    });

    const { getTimings } = await loadService();

    await expect(getTimings(params)).rejects.toMatchObject({
      name: "AladhanServiceError",
      code: "INVALID_RESPONSE",
      status: 502,
    });
  });

  it("retries once for 429 and then succeeds", async () => {
    (mockAxiosGet as any)
      .mockResolvedValueOnce({
        status: 429,
        data: {},
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            timings: validTimings,
          },
        },
      });

    const { getTimings } = await loadService();
    const result = await getTimings(params);

    expect(result.stale).toBe(false);
    expect(result.cacheStatus).toBe("miss");
    expect(mockAxiosGet).toHaveBeenCalledTimes(2);
  });

  it("coalesces identical in-flight timings requests", async () => {
    let resolveAxios: ((value: unknown) => void) | undefined;
    (mockAxiosGet as any).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAxios = resolve;
        }),
    );

    const { getTimings } = await loadService();

    const requestA = getTimings(params);
    const requestB = getTimings(params);

    expect(mockAxiosGet).toHaveBeenCalledTimes(1);

    resolveAxios?.({
      status: 200,
      data: {
        data: {
          timings: validTimings,
        },
      },
    });

    const [resultA, resultB] = await Promise.all([requestA, requestB]);
    expect(resultA.data).toEqual(resultB.data);
    expect(resultA.cacheStatus).toBe("miss");
    expect(resultB.cacheStatus).toBe("miss");
  });

  it("serves stale timings cache when upstream fails after TTL expiry", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));

    (mockAxiosGet as any)
      .mockResolvedValueOnce({
        status: 200,
        data: {
          data: {
            timings: validTimings,
          },
        },
      })
      .mockRejectedValueOnce(new Error("network down"));

    const { getTimings } = await loadService();

    const first = await getTimings(params);
    expect(first.stale).toBe(false);
    expect(first.cacheStatus).toBe("miss");

    jest.setSystemTime(new Date("2026-02-01T00:10:00.000Z"));
    const second = await getTimings(params);

    expect(second.stale).toBe(true);
    expect(second.cacheStatus).toBe("stale");
    expect(second.data.timings).toEqual(validTimings);
    expect(mockAxiosGet).toHaveBeenCalledTimes(2);
  });
});
