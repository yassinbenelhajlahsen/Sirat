import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { AppState, DeviceEventEmitter } from "react-native";

import { useHomePrayerTimes } from "@/hooks/useHomePrayerTimes";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  hasServicesEnabledAsync: jest.fn(async () => true),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 30.04, longitude: 31.23 },
  })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  reverseGeocodeAsync: jest.fn(async () => [{ city: "Cairo", isoCountryCode: "EG" }]),
}));

jest.mock("@/services/prayerTimes", () => ({
  getPrayerTimesToday: jest.fn(),
}));

jest.mock("@/hooks/useNextPrayer", () => ({
  useNextPrayer: jest.fn(() => ({
    nextPrayer: "Dhuhr",
    timeLeft: "1h",
  })),
}));

import { getPrayerTimesToday } from "@/services/prayerTimes";
import * as Location from "expo-location";

const mockGetPrayerTimesToday = getPrayerTimesToday as jest.MockedFunction<
  typeof getPrayerTimesToday
>;

const mockReverseGeocode = Location.reverseGeocodeAsync as jest.Mock;
const mockGetLastKnown = Location.getLastKnownPositionAsync as jest.Mock;

describe("useHomePrayerTimes", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();

    await AsyncStorage.setItem(
      "prayerSettings",
      JSON.stringify({
        useLocation: false,
        method: 2,
        city: {
          name: "Chicago",
          lat: 41.88,
          lng: -87.63,
          country: "US",
        },
      }),
    );
  });

  afterEach(() => {
    resetTestTime();
    jest.restoreAllMocks();
  });

  it("reloads on settingsChanged and app foreground events", async () => {
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));

    mockGetPrayerTimesToday.mockResolvedValue([
      { label: "Fajr", time: "5:00 AM" },
      { label: "Dhuhr", time: "12:00 PM" },
      { label: "Isha", time: "8:00 PM" },
    ] as any);

    let settingsChangedListener: (() => void | Promise<void>) | null = null;
    let appStateListener: ((state: string) => void | Promise<void>) | null = null;

    jest.spyOn(DeviceEventEmitter, "addListener").mockImplementation(((event: string, cb: any) => {
      if (event === "settingsChanged") {
        settingsChangedListener = cb;
      }
      return { remove: jest.fn() } as any;
    }) as any);

    jest.spyOn(AppState, "addEventListener").mockImplementation(((event: string, cb: any) => {
      if (event === "change") {
        appStateListener = cb;
      }
      return { remove: jest.fn() } as any;
    }) as any);

    const { result } = renderHook(() => useHomePrayerTimes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetPrayerTimesToday).toHaveBeenCalledTimes(1);

    await act(async () => {
      await settingsChangedListener?.();
    });

    await waitFor(() => {
      expect(mockGetPrayerTimesToday).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      await appStateListener?.("active");
    });

    await waitFor(() => {
      expect(mockGetPrayerTimesToday).toHaveBeenCalledTimes(3);
    });
  });

  it("loads next-day fajr when there are no upcoming prayers today", async () => {
    freezeTestTime(new Date(2026, 1, 25, 21, 0, 0));

    mockGetPrayerTimesToday
      .mockResolvedValueOnce([
        { label: "Fajr", time: "5:00 AM" },
        { label: "Dhuhr", time: "12:00 PM" },
        { label: "Isha", time: "8:00 PM" },
      ] as any)
      .mockResolvedValueOnce([
        { label: "Fajr", time: "5:10 AM" },
        { label: "Dhuhr", time: "12:05 PM" },
      ] as any);

    const { result } = renderHook(() => useHomePrayerTimes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.nextDayFajr).toBe("5:10 AM");
    });

    expect(result.current.locationLabel).toBe("Chicago");
    expect(mockGetPrayerTimesToday).toHaveBeenCalledTimes(2);
  });

  describe("location label fallback (useLocation: true)", () => {
    beforeEach(async () => {
      freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));
      await AsyncStorage.setItem(
        "prayerSettings",
        JSON.stringify({ useLocation: true, method: 2, city: null }),
      );
      mockGetPrayerTimesToday.mockResolvedValue([
        { label: "Fajr", time: "5:00 AM" },
        { label: "Dhuhr", time: "12:00 PM" },
        { label: "Isha", time: "8:00 PM" },
      ] as any);
    });

    it("shows the resolved city when reverse geocoding succeeds", async () => {
      const { result } = renderHook(() => useHomePrayerTimes());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.locationLabel).toBe("Cairo, EG");
    });

    it("never shows raw coordinates when reverse geocoding fails — falls back to cached city", async () => {
      await AsyncStorage.setItem("notif_city_display_loc_v1", "Cairo");
      mockReverseGeocode.mockRejectedValue(new Error("kCLErrorDomain"));
      mockGetLastKnown.mockResolvedValue(null);

      const { result } = renderHook(() => useHomePrayerTimes());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.locationLabel).not.toMatch(/^Lat /);
      expect(result.current.locationLabel).toBe("Cairo");
    });

    it("degrades to 'your area' when geocoding fails and no cache exists", async () => {
      mockReverseGeocode.mockRejectedValue(new Error("kCLErrorDomain"));
      mockGetLastKnown.mockResolvedValue(null);

      const { result } = renderHook(() => useHomePrayerTimes());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.locationLabel).not.toMatch(/^Lat /);
      expect(result.current.locationLabel).toBe("your area");
    });
  });
});
