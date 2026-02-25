import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  buildPrayerCacheKey,
  clearPrayerMemoryCache,
  loadPrayerStorageCache,
  readPrayerMemoryCache,
  savePrayerStorageCache,
  writePrayerMemoryCache,
} from "@/services/prayer-times/cacheStore";

describe("prayer-times/cacheStore", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(async () => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    clearPrayerMemoryCache();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("builds cache keys that vary by method/city/bucket", () => {
    const base = buildPrayerCacheKey({
      year: 2026,
      settings: { useLocation: true, method: 2, city: { name: "Chicago", lat: 41.88, lng: -87.63, country: "US" } },
      bucket: "41.88,-87.63",
    }).cacheKey;

    const methodChanged = buildPrayerCacheKey({
      year: 2026,
      settings: { useLocation: true, method: 3, city: { name: "Chicago", lat: 41.88, lng: -87.63, country: "US" } },
      bucket: "41.88,-87.63",
    }).cacheKey;

    const cityChanged = buildPrayerCacheKey({
      year: 2026,
      settings: { useLocation: true, method: 2, city: { name: "New York", lat: 40.71, lng: -74.0, country: "US" } },
      bucket: "40.71,-74.00",
    }).cacheKey;

    expect(base).not.toBe(methodChanged);
    expect(base).not.toBe(cityChanged);
  });

  it("reads and writes memory cache", () => {
    const cache = {
      cacheKey: "2026::k::b",
      year: 2026,
      data: {
        "2026-02-25": [{ label: "Fajr", time: "5:00 AM" }],
      },
    };

    expect(readPrayerMemoryCache(cache.cacheKey)).toBeNull();
    writePrayerMemoryCache(cache as any);
    expect(readPrayerMemoryCache(cache.cacheKey)).toEqual(cache);
  });

  it("saves and loads storage cache", async () => {
    const cache = {
      cacheKey: "2026::storage-key",
      year: 2026,
      data: {
        "2026-02-25": [{ label: "Fajr", time: "5:00 AM" }],
      },
    };

    await savePrayerStorageCache(cache as any);

    await expect(loadPrayerStorageCache(cache.cacheKey)).resolves.toEqual(cache);
  });

  it("returns null when storage payload is invalid json", async () => {
    await AsyncStorage.setItem("prayerCalendar-bad", "{invalid json");
    await expect(loadPrayerStorageCache("bad")).resolves.toBeNull();
  });
});
