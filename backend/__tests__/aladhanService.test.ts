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
  const holidayYear = 2026;
  const calendarParams = {
    latitude: 40.7128,
    longitude: -74.006,
    method: 2,
    month: 2,
    year: 2026,
  };
  const calendarYearParams = {
    latitude: 40.7128,
    longitude: -74.006,
    method: 2,
    year: 2026,
  };
  const validCalendarDay = {
    date: { gregorian: { date: "01-02-2026" } },
    timings: validTimings,
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

  function holidayMonthResponse(data: unknown) {
    return {
      status: 200,
      data: { data },
    };
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

  it("serves timings from fresh cache on repeated request", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      status: 200,
      data: {
        data: {
          timings: validTimings,
        },
      },
    });

    const { getTimings } = await loadService();

    const first = await getTimings(params);
    const second = await getTimings(params);

    expect(first.cacheStatus).toBe("miss");
    expect(second.cacheStatus).toBe("hit");
    expect(second.stale).toBe(false);
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
  });

  it("throws INVALID_RESPONSE when upstream payload misses data key", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      status: 200,
      data: {},
    });

    const { getTimings } = await loadService();

    await expect(getTimings(params)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 502,
      retriable: false,
    });
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

  it("throws RATE_LIMIT after exhausting retries on 429", async () => {
    (mockAxiosGet as any)
      .mockResolvedValueOnce({ status: 429, data: {} })
      .mockResolvedValueOnce({ status: 429, data: {} })
      .mockResolvedValueOnce({ status: 429, data: {} });

    const { getTimings } = await loadService();

    await expect(getTimings(params)).rejects.toMatchObject({
      code: "RATE_LIMIT",
      status: 429,
      retriable: true,
    });
    expect(mockAxiosGet).toHaveBeenCalledTimes(3);
  });

  it("throws UPSTREAM_SERVER_ERROR after exhausting retries on 5xx", async () => {
    (mockAxiosGet as any)
      .mockResolvedValueOnce({ status: 500, data: {} })
      .mockResolvedValueOnce({ status: 500, data: {} })
      .mockResolvedValueOnce({ status: 500, data: {} });

    const { getTimings } = await loadService();

    await expect(getTimings(params)).rejects.toMatchObject({
      code: "UPSTREAM_SERVER_ERROR",
      status: 502,
      retriable: true,
    });
    expect(mockAxiosGet).toHaveBeenCalledTimes(3);
  });

  it("throws UPSTREAM_BAD_REQUEST on non-retryable 4xx", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      status: 400,
      data: {},
    });

    const { getTimings } = await loadService();

    await expect(getTimings(params)).rejects.toMatchObject({
      code: "UPSTREAM_BAD_REQUEST",
      status: 502,
      retriable: false,
    });
  });

  it("throws NETWORK_ERROR when request layer throws", async () => {
    (mockAxiosGet as any).mockRejectedValue(new Error("socket hang up"));

    const { getTimings } = await loadService();

    await expect(getTimings(params)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 502,
      retriable: true,
    });
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

  it("returns sanitized calendar payload", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      status: 200,
      data: {
        data: [validCalendarDay],
      },
    });

    const { getCalendar } = await loadService();
    const result = await getCalendar(calendarParams);

    expect(result.stale).toBe(false);
    expect(result.cacheStatus).toBe("miss");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].timings).toEqual(validTimings);
  });

  it("throws INVALID_RESPONSE for malformed calendar day payload", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      status: 200,
      data: {
        data: [null],
      },
    });

    const { getCalendar } = await loadService();

    await expect(getCalendar(calendarParams)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 502,
    });
  });

  it("throws INVALID_RESPONSE when calendar day is missing gregorian date", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      status: 200,
      data: {
        data: [
          {
            date: { gregorian: {} },
            timings: validTimings,
          },
        ],
      },
    });

    const { getCalendar } = await loadService();

    await expect(getCalendar(calendarParams)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 502,
    });
  });

  it("serves stale calendar cache when upstream fails after TTL expiry", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));

    (mockAxiosGet as any)
      .mockResolvedValueOnce({
        status: 200,
        data: {
          data: [validCalendarDay],
        },
      })
      .mockRejectedValueOnce(new Error("network down"));

    const { getCalendar } = await loadService();

    const first = await getCalendar(calendarParams);
    expect(first.stale).toBe(false);
    expect(first.cacheStatus).toBe("miss");

    jest.setSystemTime(new Date("2026-02-01T13:00:00.000Z"));
    const second = await getCalendar(calendarParams);

    expect(second.stale).toBe(true);
    expect(second.cacheStatus).toBe("stale");
    expect(second.data).toEqual(first.data);
  });

  it("returns partial calendar year when some months fail", async () => {
    (mockAxiosGet as any).mockImplementation((_url: string, config: any) => {
      const month = config?.params?.month;
      if (month === 3 || month === 9) {
        return Promise.reject(new Error(`month ${month} down`));
      }

      return Promise.resolve({
        status: 200,
        data: {
          data: [
            {
              date: {
                gregorian: { date: `01-${String(month).padStart(2, "0")}-2026` },
              },
              timings: validTimings,
            },
          ],
        },
      });
    });

    const { getCalendarYear } = await loadService();
    const result = await getCalendarYear(calendarYearParams);

    expect(result.data.partial).toBe(true);
    expect(result.data.failedMonths).toEqual([3, 9]);
    expect(result.data.fetchedMonths.length).toBe(10);
    expect(result.data.days.length).toBe(10);
    expect(result.cacheStatus).toBe("miss");
    expect(result.stale).toBe(false);
  });

  it("throws when every calendar year month fails and no stale cache exists", async () => {
    (mockAxiosGet as any).mockRejectedValue(new Error("all months down"));

    const { getCalendarYear } = await loadService();

    await expect(getCalendarYear(calendarYearParams)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 502,
    });
  });

  it("serves stale calendar year cache when fresh fetch fully fails", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    (mockAxiosGet as any).mockImplementation((_url: string, config: any) => {
      const month = config?.params?.month;
      return Promise.resolve({
        status: 200,
        data: {
          data: [
            {
              date: {
                gregorian: { date: `01-${String(month).padStart(2, "0")}-2026` },
              },
              timings: validTimings,
            },
          ],
        },
      });
    });

    const { getCalendarYear } = await loadService();
    const first = await getCalendarYear(calendarYearParams);
    expect(first.cacheStatus).toBe("miss");
    expect(first.stale).toBe(false);

    (mockAxiosGet as any).mockRejectedValue(new Error("all months down"));
    jest.setSystemTime(new Date("2026-01-01T13:00:00.000Z"));
    const second = await getCalendarYear(calendarYearParams);

    expect(second.cacheStatus).toBe("stale");
    expect(second.stale).toBe(true);
    expect(second.data.days).toEqual(first.data.days);
  });

  it("throws when all holiday months fail and no stale cache exists", async () => {
    (mockAxiosGet as any).mockRejectedValue(new Error("network down"));

    const { getHolidays } = await loadService();

    await expect(getHolidays(holidayYear)).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      status: 502,
      retriable: true,
    });
  });

  it("returns partial holiday payload when some months fail", async () => {
    (mockAxiosGet as any).mockImplementation((url: string) => {
      const match = /gToHCalendar\/(\d+)\/2026$/.exec(url);
      if (!match) {
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }

      const month = Number.parseInt(match[1], 10);
      if (month === 4 || month === 11) {
        return Promise.reject(new Error("month failed"));
      }

      return Promise.resolve(
        holidayMonthResponse([
          {
            gregorian: { date: `01-${String(month).padStart(2, "0")}-2026` },
            hijri: { holidays: [`Holiday ${month}`] },
          },
        ]),
      );
    });

    const { getHolidays } = await loadService();
    const result = await getHolidays(holidayYear);

    expect(result.cacheStatus).toBe("miss");
    expect(result.stale).toBe(false);
    expect(result.data.holidays.length).toBe(10);
  });

  it("returns sanitized and deduplicated holidays by date", async () => {
    (mockAxiosGet as any).mockImplementation((url: string) => {
      const match = /gToHCalendar\/(\d+)\/2026$/.exec(url);
      if (!match) {
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      }

      const month = Number.parseInt(match[1], 10);
      if (month === 1) {
        return Promise.resolve(
          holidayMonthResponse([
            {
              gregorian: { date: "01-01-2026" },
              hijri: { holidays: ["Islamic New Year"] },
            },
            {
              gregorian: { date: "31-02-2026" },
              hijri: { holidays: ["Invalid Date"] },
            },
            {
              gregorian: { date: "01-01-2026" },
              hijri: { holidays: ["Duplicate Name"] },
            },
            {
              gregorian: { date: "02-01-2026" },
              hijri: { holidays: "not-array" },
            },
          ]),
        );
      }

      if (month === 2) {
        return Promise.resolve(
          holidayMonthResponse([
            {
              gregorian: { date: "15-02-2026" },
              hijri: { holidays: ["Mid-Sha'ban"] },
            },
          ]),
        );
      }

      return Promise.resolve(holidayMonthResponse([]));
    });

    const { getHolidays } = await loadService();
    const result = await getHolidays(holidayYear);

    expect(result.stale).toBe(false);
    expect(result.cacheStatus).toBe("miss");
    expect(result.data.holidays).toEqual([
      { date: "2026-01-01", name: "Islamic New Year" },
      { date: "2026-02-15", name: "Mid-Sha'ban" },
    ]);
    expect(mockAxiosGet).toHaveBeenCalledTimes(12);
  });

  it("coalesces identical in-flight holiday requests", async () => {
    (mockAxiosGet as any).mockImplementation(() =>
      Promise.resolve(
        holidayMonthResponse([
          {
            gregorian: { date: "01-01-2026" },
            hijri: { holidays: ["Islamic New Year"] },
          },
        ]),
      ),
    );

    const { getHolidays } = await loadService();
    const requestA = getHolidays(holidayYear);
    const requestB = getHolidays(holidayYear);

    const [resultA, resultB] = await Promise.all([requestA, requestB]);

    expect(resultA.data).toEqual(resultB.data);
    expect(resultA.cacheStatus).toBe("miss");
    expect(resultB.cacheStatus).toBe("miss");
    expect(mockAxiosGet).toHaveBeenCalledTimes(12);
  });

  it("serves stale holiday cache when upstream fails after TTL expiry", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    let callCount = 0;
    (mockAxiosGet as any).mockImplementation(() => {
      callCount += 1;
      if (callCount <= 12) {
        return Promise.resolve(
          holidayMonthResponse([
            {
              gregorian: { date: "01-01-2026" },
              hijri: { holidays: ["Islamic New Year"] },
            },
          ]),
        );
      }
      return Promise.reject(new Error("network down"));
    });

    const { getHolidays } = await loadService();

    const first = await getHolidays(holidayYear);
    expect(first.stale).toBe(false);
    expect(first.cacheStatus).toBe("miss");

    jest.setSystemTime(new Date("2026-01-02T01:00:00.000Z"));
    const second = await getHolidays(holidayYear);

    expect(second.stale).toBe(true);
    expect(second.cacheStatus).toBe("stale");
    expect(second.data.holidays).toEqual(first.data.holidays);
    expect(mockAxiosGet).toHaveBeenCalledTimes(24);
  });
});
