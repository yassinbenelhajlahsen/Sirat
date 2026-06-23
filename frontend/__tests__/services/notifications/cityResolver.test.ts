import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import { resolveCityDisplay } from "@/services/notifications/cityResolver";
import { STORAGE_CITY_DISPLAY_LOC } from "@/services/notifications/constants";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
}));

const mockGetCurrentPosition = Location.getCurrentPositionAsync as jest.Mock;
const mockGetLastKnown = Location.getLastKnownPositionAsync as jest.Mock;
const mockReverseGeocode = Location.reverseGeocodeAsync as jest.Mock;

const COORDS = { latitude: 30.04, longitude: 31.23 };

describe("resolveCityDisplay", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("reverse-geocodes caller-supplied coords without fetching a new position", async () => {
    mockReverseGeocode.mockResolvedValue([{ city: "Cairo" }]);

    const label = await resolveCityDisplay({ useLocation: true }, COORDS);

    expect(label).toBe("Cairo");
    expect(mockReverseGeocode).toHaveBeenCalledWith(COORDS);
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    await expect(
      AsyncStorage.getItem(STORAGE_CITY_DISPLAY_LOC),
    ).resolves.toBe("Cairo");
  });

  it("falls through to the current position when the supplied coords fail", async () => {
    mockReverseGeocode
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValueOnce([{ city: "Cairo" }]);
    mockGetCurrentPosition.mockResolvedValue({ coords: COORDS });

    const label = await resolveCityDisplay({ useLocation: true }, COORDS);

    expect(label).toBe("Cairo");
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("falls back to the last-known position when live geocoding fails", async () => {
    mockReverseGeocode
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce([{ city: "Cairo" }]);
    mockGetCurrentPosition.mockRejectedValue(new Error("no position"));
    mockGetLastKnown.mockResolvedValue({ coords: COORDS });

    const label = await resolveCityDisplay({ useLocation: true }, COORDS);

    expect(label).toBe("Cairo");
  });

  it("returns the cached city when all geocoding fails", async () => {
    await AsyncStorage.setItem(STORAGE_CITY_DISPLAY_LOC, "Cairo");
    mockReverseGeocode.mockRejectedValue(new Error("offline"));
    mockGetCurrentPosition.mockRejectedValue(new Error("no position"));
    mockGetLastKnown.mockResolvedValue(null);

    const label = await resolveCityDisplay({ useLocation: true }, COORDS);

    expect(label).toBe("Cairo");
  });

  it("degrades to 'your area' when everything fails and no cache exists", async () => {
    mockReverseGeocode.mockRejectedValue(new Error("offline"));
    mockGetCurrentPosition.mockRejectedValue(new Error("no position"));
    mockGetLastKnown.mockResolvedValue(null);

    const label = await resolveCityDisplay({ useLocation: true }, COORDS);

    expect(label).toBe("your area");
  });

  it("never returns raw coordinates", async () => {
    mockReverseGeocode.mockRejectedValue(new Error("offline"));
    mockGetCurrentPosition.mockRejectedValue(new Error("no position"));
    mockGetLastKnown.mockResolvedValue(null);

    const label = await resolveCityDisplay({ useLocation: true }, COORDS);

    expect(label).not.toMatch(/\d/);
  });
});
