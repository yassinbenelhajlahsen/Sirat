import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("googleMapsService", () => {
  const originalEnv = process.env;
  const mockAxiosGet: jest.Mock = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    mockAxiosGet.mockReset();
    process.env = {
      ...originalEnv,
      GOOGLE_MAPS_API_KEY: "test-google-api-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("maps Google Places results into mosque response shape", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      data: {
        status: "OK",
        results: [
          {
            place_id: "place-1",
            name: "Masjid Al Noor",
            vicinity: "123 Main St",
            geometry: { location: { lat: 40.1, lng: -73.9 } },
          },
        ],
      },
    });

    jest.unstable_mockModule("axios", () => ({
      default: { get: mockAxiosGet },
    }));

    const { getNearbyMosques } = await import("../src/services/googleMapsService.js");
    const result = await getNearbyMosques({
      latitude: 40.7128,
      longitude: -74.006,
      radius: 3000,
    });

    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    expect(result).toEqual([
      {
        id: "place-1",
        name: "Masjid Al Noor",
        address: "123 Main St",
        lat: 40.1,
        lng: -73.9,
      },
    ]);
  });

  it("returns an empty array for ZERO_RESULTS", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      data: {
        status: "ZERO_RESULTS",
        results: [],
      },
    });

    jest.unstable_mockModule("axios", () => ({
      default: { get: mockAxiosGet },
    }));

    const { getNearbyMosques } = await import("../src/services/googleMapsService.js");
    const result = await getNearbyMosques({
      latitude: 0,
      longitude: 0,
    });

    expect(result).toEqual([]);
  });

  it("throws when Google Places returns a non-success status", async () => {
    (mockAxiosGet as any).mockResolvedValue({
      data: {
        status: "REQUEST_DENIED",
        error_message: "API key is invalid.",
      },
    });

    jest.unstable_mockModule("axios", () => ({
      default: { get: mockAxiosGet },
    }));

    const { getNearbyMosques } = await import("../src/services/googleMapsService.js");

    await expect(
      getNearbyMosques({
        latitude: 40.7128,
        longitude: -74.006,
      }),
    ).rejects.toThrow("Google Maps API error: REQUEST_DENIED - API key is invalid.");
  });

  it("throws when Google Maps API key is missing", async () => {
    process.env = { ...originalEnv, GOOGLE_MAPS_API_KEY: "" };
    jest.resetModules();
    mockAxiosGet.mockReset();

    jest.unstable_mockModule("axios", () => ({
      default: { get: mockAxiosGet },
    }));

    const { getNearbyMosques } = await import("../src/services/googleMapsService.js");

    await expect(
      getNearbyMosques({
        latitude: 40.7128,
        longitude: -74.006,
      }),
    ).rejects.toThrow("Google Maps API key is not configured");
  });
});
