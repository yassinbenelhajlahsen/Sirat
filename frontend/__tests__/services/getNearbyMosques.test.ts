import AsyncStorage from "@react-native-async-storage/async-storage";

type MosqueMocks = {
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

function loadMosqueService(overrides?: Partial<MosqueMocks>) {
  jest.resetModules();

  const mocks: MosqueMocks = {
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    getCurrentPositionAsync: jest.fn(async () => ({
      coords: { latitude: 41.881, longitude: -87.623 },
    })),
  };

  Object.assign(mocks, overrides ?? {});

  jest.doMock("expo-location", () => ({
    requestForegroundPermissionsAsync: mocks.requestForegroundPermissionsAsync,
    getCurrentPositionAsync: mocks.getCurrentPositionAsync,
  }));

  const mod = require("@/services/getNearbyMosques") as typeof import("@/services/getNearbyMosques");
  return {
    getNearbyMosques: mod.getNearbyMosques,
    getCachedMosques: mod.getCachedMosques,
    mocks,
  };
}

describe("services/getNearbyMosques", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (global.fetch as jest.Mock).mockReset();
  });

  it("gates on location permission for live fetch", async () => {
    const { getNearbyMosques } = loadMosqueService({
      requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
    });

    await expect(getNearbyMosques()).rejects.toThrow("Permission denied");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns mosques from API using provided coords", async () => {
    const rows = [{ id: "m1", name: "Masjid", address: "A", lat: 1, lng: 2 }];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: rows }),
    });

    const { getNearbyMosques, mocks } = loadMosqueService();
    const data = await getNearbyMosques(10.1, 20.2);

    expect(data).toEqual(rows);
    expect(mocks.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("latitude=10.1&longitude=20.2&radius=3000"),
    );
  });

  it("uses device coordinates when args are missing", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    const { getNearbyMosques, mocks } = loadMosqueService();
    await getNearbyMosques();

    expect(mocks.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("latitude=41.881&longitude=-87.623&radius=3000"),
    );
  });

  it("throws API error on non-2xx response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const { getNearbyMosques } = loadMosqueService();

    await expect(getNearbyMosques(1, 2)).rejects.toThrow("Mosque API error: 500");
  });

  it("returns cached data when fresh and skips live fetch", async () => {
    const cacheKey = "mosques_41.88_-87.62";
    const cachedRows = [{ id: "c1", name: "Cached", address: "B", lat: 1, lng: 1 }];

    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ data: cachedRows, timestamp: Date.now() }),
    );

    const { getCachedMosques } = loadMosqueService();
    const data = await getCachedMosques(41.881, -87.623);

    expect(data).toEqual(cachedRows);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refreshes cache when stale and stores fresh data", async () => {
    const cacheKey = "mosques_41.88_-87.62";
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ data: [{ id: "old" }], timestamp: Date.now() - 10_000 }),
    );

    const freshRows = [{ id: "n1", name: "New", address: "C", lat: 2, lng: 2 }];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: freshRows }),
    });

    const { getCachedMosques } = loadMosqueService();
    const data = await getCachedMosques(41.881, -87.623, 1_000);

    expect(data).toEqual(freshRows);

    const stored = JSON.parse((await AsyncStorage.getItem(cacheKey)) || "{}");
    expect(stored.data).toEqual(freshRows);
    expect(typeof stored.timestamp).toBe("number");
  });

  it("returns empty array on cached wrapper errors", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { getCachedMosques } = loadMosqueService({
      getCurrentPositionAsync: jest.fn(async () => {
        throw new Error("services disabled");
      }),
    });

    await expect(getCachedMosques()).resolves.toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
