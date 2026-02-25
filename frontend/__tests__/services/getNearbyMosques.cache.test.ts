import AsyncStorage from "@react-native-async-storage/async-storage";

type LocationMocks = {
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

function loadMosqueService(overrides?: Partial<LocationMocks>) {
  jest.resetModules();

  const mocks: LocationMocks = {
    requestForegroundPermissionsAsync: jest.fn(async () => ({
      status: "granted",
    })),
    getCurrentPositionAsync: jest.fn(async () => ({
      coords: { latitude: 41.881, longitude: -87.623 },
    })),
  };

  Object.assign(mocks, overrides ?? {});

  jest.doMock("expo-location", () => ({
    requestForegroundPermissionsAsync: mocks.requestForegroundPermissionsAsync,
    getCurrentPositionAsync: mocks.getCurrentPositionAsync,
  }));

  const mod =
    require("@/services/getNearbyMosques") as typeof import("@/services/getNearbyMosques");

  return {
    getCachedMosques: mod.getCachedMosques,
    mocks,
  };
}

describe("services/getNearbyMosques cache contracts", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    (global.fetch as jest.Mock).mockReset();
  });

  it("reuses the same cache bucket when coordinates round to the same key", async () => {
    const now = 1_700_000_000_000;
    jest.spyOn(Date, "now").mockReturnValue(now);

    const cachedRows = [
      { id: "m1", name: "Cached Mosque", address: "A", lat: 41.88, lng: -87.62 },
    ];
    await AsyncStorage.setItem(
      "mosques_41.88_-87.62",
      JSON.stringify({ data: cachedRows, timestamp: now - 100 }),
    );

    const { getCachedMosques } = loadMosqueService();

    const first = await getCachedMosques(41.881, -87.623, 1_000);
    const second = await getCachedMosques(41.884, -87.621, 1_000);

    expect(first).toEqual(cachedRows);
    expect(second).toEqual(cachedRows);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("invalidates cache exactly at the ttl boundary and refreshes from network", async () => {
    const now = 1_700_000_010_000;
    jest.spyOn(Date, "now").mockReturnValue(now);

    await AsyncStorage.setItem(
      "mosques_41.88_-87.62",
      JSON.stringify({
        data: [{ id: "old", name: "Old", address: "B", lat: 1, lng: 2 }],
        timestamp: now - 1_000,
      }),
    );

    const freshRows = [
      { id: "new", name: "Fresh", address: "C", lat: 3, lng: 4 },
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: freshRows }),
    });

    const { getCachedMosques } = loadMosqueService();
    const data = await getCachedMosques(41.881, -87.623, 1_000);

    expect(data).toEqual(freshRows);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("derives and persists the rounded cache key when location fallback is used", async () => {
    const now = 1_700_000_020_000;
    jest.spyOn(Date, "now").mockReturnValue(now);

    const rows = [
      { id: "x1", name: "Masjid X", address: "D", lat: 35.12, lng: -80.99 },
    ];
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: rows }),
    });

    const { getCachedMosques, mocks } = loadMosqueService({
      getCurrentPositionAsync: jest.fn(async () => ({
        coords: { latitude: 35.1234, longitude: -80.9876 },
      })),
    });

    const result = await getCachedMosques(undefined, undefined, 10_000);
    expect(result).toEqual(rows);
    expect(mocks.getCurrentPositionAsync).toHaveBeenCalledTimes(1);

    const raw = await AsyncStorage.getItem("mosques_35.12_-80.99");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}") as {
      data: unknown[];
      timestamp: number;
    };
    expect(parsed.data).toEqual(rows);
    expect(parsed.timestamp).toBe(now);
  });
});
