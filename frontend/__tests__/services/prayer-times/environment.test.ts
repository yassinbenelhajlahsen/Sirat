type LocationMocks = {
  hasServicesEnabledAsync: jest.Mock;
  getForegroundPermissionsAsync: jest.Mock;
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
  getLastKnownPositionAsync: jest.Mock;
  reverseGeocodeAsync: jest.Mock;
};

function loadEnvironment(overrides?: Partial<LocationMocks>) {
  jest.resetModules();

  const mocks: LocationMocks = {
    hasServicesEnabledAsync: jest.fn(async () => true),
    getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    getCurrentPositionAsync: jest.fn(async () => ({
      coords: { latitude: 41.881, longitude: -87.623 },
    })),
    getLastKnownPositionAsync: jest.fn(async () => null),
    reverseGeocodeAsync: jest.fn(async () => [{ country: "United States", isoCountryCode: "US" }]),
  };

  Object.assign(mocks, overrides ?? {});

  jest.doMock("expo-location", () => ({
    Accuracy: { Balanced: 3 },
    hasServicesEnabledAsync: mocks.hasServicesEnabledAsync,
    getForegroundPermissionsAsync: mocks.getForegroundPermissionsAsync,
    requestForegroundPermissionsAsync: mocks.requestForegroundPermissionsAsync,
    getCurrentPositionAsync: mocks.getCurrentPositionAsync,
    getLastKnownPositionAsync: mocks.getLastKnownPositionAsync,
    reverseGeocodeAsync: mocks.reverseGeocodeAsync,
  }));

  const mod = require("@/services/prayer-times/environment");
  return {
    resolveCoordsAndCountry: mod.resolveCoordsAndCountry as (settings: any, override?: any) => Promise<any>,
    mocks,
  };
}

describe("prayer-times/environment", () => {
  it("uses override coords + country when provided", async () => {
    const { resolveCoordsAndCountry, mocks } = loadEnvironment();

    const env = await resolveCoordsAndCountry(
      { useLocation: true, method: 2 },
      { coords: { latitude: 10.1234, longitude: 20.5678 }, country: "EG" },
    );

    expect(env).toEqual({
      latitude: 10.1234,
      longitude: 20.5678,
      bucket: "10.12,20.57",
      country: "EG",
    });
    expect(mocks.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("uses manual city when location is disabled", async () => {
    const { resolveCoordsAndCountry } = loadEnvironment();

    await expect(
      resolveCoordsAndCountry({
        useLocation: false,
        method: 2,
        city: { name: "Chicago", lat: 41.881, lng: -87.623, country: "US" },
      }),
    ).resolves.toEqual({
      latitude: 41.881,
      longitude: -87.623,
      country: "US",
      bucket: "41.88,-87.62",
    });
  });

  it("fetches device coords and reverse geocoded country when allowed", async () => {
    const { resolveCoordsAndCountry, mocks } = loadEnvironment();

    const env = await resolveCoordsAndCountry({ useLocation: true, method: 2 });

    expect(mocks.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    expect(mocks.reverseGeocodeAsync).toHaveBeenCalledTimes(1);
    expect(env.country).toBe("United States");
    expect(env.bucket).toBe("41.88,-87.62");
  });

  it("requests permission when initially denied, then proceeds if granted", async () => {
    const { resolveCoordsAndCountry, mocks } = loadEnvironment({
      getForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
      requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    });

    const env = await resolveCoordsAndCountry({ useLocation: true, method: 2 });

    expect(mocks.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(env.latitude).toBeCloseTo(41.881);
  });

  it("falls back to manual city when location is unavailable", async () => {
    const { resolveCoordsAndCountry } = loadEnvironment({
      hasServicesEnabledAsync: jest.fn(async () => false),
      getForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
      requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
    });

    const env = await resolveCoordsAndCountry({
      useLocation: true,
      method: 2,
      city: { name: "Toronto", lat: 43.65, lng: -79.38, country: "CA" },
    });

    expect(env).toEqual({
      latitude: 43.65,
      longitude: -79.38,
      country: "CA",
      bucket: "43.65,-79.38",
    });
  });

  it("throws a user-facing error when location is unavailable and no city exists", async () => {
    const { resolveCoordsAndCountry } = loadEnvironment({
      hasServicesEnabledAsync: jest.fn(async () => false),
      getForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
      requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "denied" })),
    });

    await expect(
      resolveCoordsAndCountry({ useLocation: true, method: 2 }),
    ).rejects.toThrow(
      "Location unavailable. Enable Location Services or set a manual city in Settings.",
    );
  });
  describe("when a fresh location fix fails", () => {
    const failFix = jest.fn(async () => {
      throw new Error("LocationUnavailable: kCLErrorDomain error 1");
    });

    it("uses the last known position", async () => {
      const { resolveCoordsAndCountry } = loadEnvironment({
        getCurrentPositionAsync: failFix,
        getLastKnownPositionAsync: jest.fn(async () => ({
          coords: { latitude: 30.04, longitude: 31.23 },
        })),
      });

      const env = await resolveCoordsAndCountry({ useLocation: true, method: 2 });

      expect(env.latitude).toBeCloseTo(30.04);
      expect(env.bucket).toBe("30.04,31.23");
    });

    it("falls back to the saved city when there is no last known position", async () => {
      const { resolveCoordsAndCountry } = loadEnvironment({ getCurrentPositionAsync: failFix });

      const env = await resolveCoordsAndCountry({
        useLocation: true,
        method: 2,
        city: { name: "Toronto", lat: 43.65, lng: -79.38, country: "CA" },
      });

      expect(env.bucket).toBe("43.65,-79.38");
    });

    it("still reports unavailable location when nothing else is known", async () => {
      const { resolveCoordsAndCountry } = loadEnvironment({ getCurrentPositionAsync: failFix });

      await expect(
        resolveCoordsAndCountry({ useLocation: true, method: 2 }),
      ).rejects.toThrow("Location unavailable.");
    });
  });
});
