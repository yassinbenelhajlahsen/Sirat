type PrayerTimesModuleSetup = {
  mod: typeof import("@/services/prayerTimes");
  mocks: {
    buildPrayerCacheKey: jest.Mock;
    clearPrayerMemoryCache: jest.Mock;
    loadPrayerStorageCache: jest.Mock;
    readPrayerMemoryCache: jest.Mock;
    savePrayerStorageCache: jest.Mock;
    writePrayerMemoryCache: jest.Mock;
    resolveCoordsAndCountry: jest.Mock;
    fetchPrayerProxy: jest.Mock;
    dateKey: jest.Mock;
    mapTimingsToPrayerTimes: jest.Mock;
    mergeCalendarDayIntoStore: jest.Mock;
  };
  memStore: Map<string, any>;
  storageStore: Map<string, any>;
};

function to12(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function loadPrayerTimesModule(): PrayerTimesModuleSetup {
  jest.resetModules();

  const memStore = new Map<string, any>();
  const storageStore = new Map<string, any>();

  const mocks = {
    buildPrayerCacheKey: jest.fn(({ year, settings, bucket }) => ({
      settingsKey: "unused",
      cacheKey: `${year}::${settings.method}::${settings.city?.name ?? ""}::${bucket ?? ""}`,
    })),
    clearPrayerMemoryCache: jest.fn(() => {
      memStore.clear();
    }),
    loadPrayerStorageCache: jest.fn(async (cacheKey: string) => storageStore.get(cacheKey) ?? null),
    readPrayerMemoryCache: jest.fn((cacheKey: string) => memStore.get(cacheKey) ?? null),
    savePrayerStorageCache: jest.fn(async (cache: any) => {
      storageStore.set(cache.cacheKey, cache);
    }),
    writePrayerMemoryCache: jest.fn((cache: any) => {
      memStore.set(cache.cacheKey, cache);
    }),
    resolveCoordsAndCountry: jest.fn(async (_settings: any, override?: any) => {
      if (override?.coords) {
        const { latitude, longitude } = override.coords;
        return {
          latitude,
          longitude,
          country: override.country ?? "",
          bucket: `${latitude.toFixed(2)},${longitude.toFixed(2)}`,
        };
      }
      return {
        latitude: 41.881,
        longitude: -87.623,
        country: "US",
        bucket: "41.88,-87.62",
      };
    }),
    fetchPrayerProxy: jest.fn(),
    dateKey: jest.fn((date: Date) => localDateKey(date)),
    mapTimingsToPrayerTimes: jest.fn((timings: any) => [
      { label: "Fajr", time: to12(timings.Fajr) },
      { label: "Sunrise", time: to12(timings.Sunrise) },
      { label: "Dhuhr", time: to12(timings.Dhuhr) },
      { label: "Asr", time: to12(timings.Asr) },
      { label: "Maghrib", time: to12(timings.Maghrib) },
      { label: "Isha", time: to12(timings.Isha) },
    ]),
    mergeCalendarDayIntoStore: jest.fn((store: Record<string, any>, day: any) => {
      const greg = day?.date?.gregorian?.date;
      if (!greg || !day.timings) return;
      const [dd, mm, yy] = greg.split("-");
      const key = `${yy}-${mm}-${dd}`;
      store[key] = [
        { label: "Fajr", time: to12(day.timings.Fajr) },
        { label: "Sunrise", time: to12(day.timings.Sunrise) },
        { label: "Dhuhr", time: to12(day.timings.Dhuhr) },
        { label: "Asr", time: to12(day.timings.Asr) },
        { label: "Maghrib", time: to12(day.timings.Maghrib) },
        { label: "Isha", time: to12(day.timings.Isha) },
      ];
    }),
  };

  jest.doMock("@/services/prayer-times/cacheStore", () => ({
    buildPrayerCacheKey: mocks.buildPrayerCacheKey,
    clearPrayerMemoryCache: mocks.clearPrayerMemoryCache,
    loadPrayerStorageCache: mocks.loadPrayerStorageCache,
    readPrayerMemoryCache: mocks.readPrayerMemoryCache,
    savePrayerStorageCache: mocks.savePrayerStorageCache,
    writePrayerMemoryCache: mocks.writePrayerMemoryCache,
  }));

  jest.doMock("@/services/prayer-times/environment", () => ({
    resolveCoordsAndCountry: mocks.resolveCoordsAndCountry,
  }));

  jest.doMock("@/services/prayer-times/apiClient", () => ({
    fetchPrayerProxy: mocks.fetchPrayerProxy,
  }));

  jest.doMock("@/services/prayer-times/transformers", () => ({
    dateKey: mocks.dateKey,
    formatTo12Hour: jest.fn(),
    mapTimingsToPrayerTimes: mocks.mapTimingsToPrayerTimes,
    mergeCalendarDayIntoStore: mocks.mergeCalendarDayIntoStore,
  }));

  const mod = require("@/services/prayerTimes") as typeof import("@/services/prayerTimes");

  return { mod, mocks, memStore, storageStore };
}

const FIXTURE_TIMINGS = {
  Fajr: "05:00",
  Sunrise: "06:20",
  Dhuhr: "12:10",
  Asr: "15:30",
  Maghrib: "18:00",
  Isha: "19:30",
};

describe("services/prayerTimes", () => {
  afterEach(() => {
    resetTestTime();
  });

  it("returns memory cache hit without storage/network calls", async () => {
    const { mod, mocks } = loadPrayerTimesModule();
    const date = new Date(2026, 1, 25, 9, 0, 0);

    mocks.readPrayerMemoryCache.mockReturnValue({
      data: {
        "2026-02-25": [{ label: "Fajr", time: "5:00 AM" }],
      },
    });

    const result = await mod.getPrayerTimesForDate({ useLocation: true, method: 2 }, date);

    expect(result).toEqual([{ label: "Fajr", time: "5:00 AM" }]);
    expect(mocks.loadPrayerStorageCache).not.toHaveBeenCalled();
    expect(mocks.fetchPrayerProxy).not.toHaveBeenCalled();
  });

  it("returns storage cache hit and writes memory cache", async () => {
    const { mod, mocks } = loadPrayerTimesModule();
    const date = new Date(2026, 1, 25, 9, 0, 0);

    mocks.readPrayerMemoryCache.mockReturnValue(null);
    mocks.loadPrayerStorageCache.mockResolvedValue({
      cacheKey: "k",
      year: 2026,
      data: {
        "2026-02-25": [{ label: "Fajr", time: "5:00 AM" }],
      },
    });

    const result = await mod.getPrayerTimesForDate({ useLocation: true, method: 2 }, date);

    expect(result).toEqual([{ label: "Fajr", time: "5:00 AM" }]);
    expect(mocks.writePrayerMemoryCache).toHaveBeenCalledTimes(1);
    expect(mocks.fetchPrayerProxy).not.toHaveBeenCalled();
  });

  it("uses fast today path and starts background yearly fetch", async () => {
    const { mod, mocks } = loadPrayerTimesModule();
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));

    mocks.fetchPrayerProxy.mockImplementation(async (path: string, params: any) => {
      if (path === "/api/prayer-times/timings") {
        return { timings: FIXTURE_TIMINGS };
      }
      if (path === "/api/prayer-times/calendar/year") {
        return {
          days: [
            {
              date: { gregorian: { date: "25-02-2026" } },
              timings: FIXTURE_TIMINGS,
            },
          ],
        };
      }
      throw new Error(`Unexpected path ${path}`);
    });

    const result = await mod.getPrayerTimesForDate(
      { useLocation: true, method: -1 },
      new Date(2026, 1, 25, 10, 0, 0),
    );

    expect(result[0]).toEqual({ label: "Fajr", time: "5:00 AM" });
    expect(mocks.fetchPrayerProxy).toHaveBeenCalledWith(
      "/api/prayer-times/timings",
      expect.objectContaining({ method: "auto", country: "US" }),
    );

    await Promise.resolve();

    expect(mocks.fetchPrayerProxy).toHaveBeenCalledWith(
      "/api/prayer-times/calendar/year",
      expect.objectContaining({ method: "auto", country: "US", year: 2026 }),
    );
    expect(mocks.savePrayerStorageCache).toHaveBeenCalled();
  });

  it("falls back to yearly fetch when fast today path fails", async () => {
    const { mod, mocks } = loadPrayerTimesModule();
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));

    mocks.fetchPrayerProxy.mockImplementation(async (path: string) => {
      if (path === "/api/prayer-times/timings") {
        throw new Error("network down");
      }
      if (path === "/api/prayer-times/calendar/year") {
        return {
          days: [
            {
              date: { gregorian: { date: "25-02-2026" } },
              timings: FIXTURE_TIMINGS,
            },
          ],
        };
      }
      throw new Error(`Unexpected path ${path}`);
    });

    const result = await mod.getPrayerTimesForDate(
      { useLocation: true, method: 2 },
      new Date(2026, 1, 25, 13, 0, 0),
    );

    expect(result[0]).toEqual({ label: "Fajr", time: "5:00 AM" });
    expect(mocks.fetchPrayerProxy).toHaveBeenCalledWith(
      "/api/prayer-times/timings",
      expect.any(Object),
    );
    expect(mocks.fetchPrayerProxy).toHaveBeenCalledWith(
      "/api/prayer-times/calendar/year",
      expect.any(Object),
    );
  });

  it("falls back to legacy monthly calendar when yearly endpoint fails", async () => {
    const { mod, mocks } = loadPrayerTimesModule();
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));

    mocks.fetchPrayerProxy.mockImplementation(async (path: string, params: any) => {
      if (path === "/api/prayer-times/calendar/year") {
        throw new Error("year endpoint unavailable");
      }
      if (path === "/api/prayer-times/calendar") {
        if (params.month === 1) {
          return [
            {
              date: { gregorian: { date: "15-01-2026" } },
              timings: FIXTURE_TIMINGS,
            },
          ];
        }
        if (params.month === 2) {
          throw new Error("partial failure after first month");
        }
      }
      throw new Error(`Unexpected path ${path}`);
    });

    const result = await mod.getPrayerTimesForDate(
      { useLocation: true, method: 4 },
      new Date(2026, 0, 15, 12, 0, 0),
    );

    expect(result[0]).toEqual({ label: "Fajr", time: "5:00 AM" });

    const monthlyCalls = mocks.fetchPrayerProxy.mock.calls.filter(
      ([path]) => path === "/api/prayer-times/calendar",
    );
    expect(monthlyCalls).toHaveLength(2);
    expect(monthlyCalls[0][1]).toEqual(expect.objectContaining({ month: 1, year: 2026, method: 4 }));
    expect(monthlyCalls[1][1]).toEqual(expect.objectContaining({ month: 2, year: 2026, method: 4 }));
  });

  it("uses distinct cache keys across method changes (no cache poisoning)", async () => {
    const { mod, mocks } = loadPrayerTimesModule();

    mocks.fetchPrayerProxy.mockImplementation(async (_path: string, params: any) => ({
      days: [
        {
          date: { gregorian: { date: "01-03-2026" } },
          timings: {
            ...FIXTURE_TIMINGS,
            Fajr: params.method === 2 ? "05:00" : "06:00",
          },
        },
      ],
    }));

    const date = new Date(2026, 2, 1, 12, 0, 0);

    const m2 = await mod.getPrayerTimesForDate({ useLocation: true, method: 2 }, date);
    const m3 = await mod.getPrayerTimesForDate({ useLocation: true, method: 3 }, date);

    expect(m2[0].time).toBe("5:00 AM");
    expect(m3[0].time).toBe("6:00 AM");

    expect(mocks.loadPrayerStorageCache.mock.calls[0][0]).not.toBe(
      mocks.loadPrayerStorageCache.mock.calls[1][0],
    );
  });

  it("uses override options in getPrayerTimesToday and short-circuits with memory cache", async () => {
    const { mod, mocks } = loadPrayerTimesModule();
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));

    mocks.readPrayerMemoryCache.mockReturnValue({
      data: {
        "2026-02-25": [{ label: "Fajr", time: "5:00 AM" }],
      },
    });

    const result = await mod.getPrayerTimesToday(
      { useLocation: true, method: 2 },
      { coords: { latitude: 43.65, longitude: -79.38 }, country: "CA" },
    );

    expect(result).toEqual([{ label: "Fajr", time: "5:00 AM" }]);
    expect(mocks.resolveCoordsAndCountry).toHaveBeenCalledWith(
      { useLocation: true, method: 2 },
      {
        coords: { latitude: 43.65, longitude: -79.38 },
        country: "CA",
      },
    );
    expect(mocks.fetchPrayerProxy).not.toHaveBeenCalled();
  });

  it("clearPrayerCache delegates to memory cache clear", async () => {
    const { mod, mocks } = loadPrayerTimesModule();

    await mod.clearPrayerCache();

    expect(mocks.clearPrayerMemoryCache).toHaveBeenCalledTimes(1);
  });
});
