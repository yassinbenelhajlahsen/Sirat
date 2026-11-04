import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, waitFor, act } from "@testing-library/react-native";
import { AppState } from "react-native";

import { useHomePrayerTimes } from "@/hooks/useHomePrayerTimes";
import { prayerSettingsSetting } from "@/services/syncedSettings";

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
  getPrayerTimesForDate: jest.fn(),
}));

jest.mock("@/hooks/useNextPrayer", () => ({
  useNextPrayer: jest.fn(() => ({
    nextPrayer: "Dhuhr",
    timeLeft: "1h",
  })),
}));

import { getPrayerTimesForDate, getPrayerTimesToday } from "@/services/prayerTimes";

const mockGetPrayerTimesForDate = getPrayerTimesForDate as jest.MockedFunction<
  typeof getPrayerTimesForDate
>;
import * as Location from "expo-location";
import { buildPrayerDay, formatClock } from "@/services/prayerDay";
const dayOf = (rows: { label: string; time: string }[], date = new Date()) => buildPrayerDay(date, rows);

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

  it("uses the manual city when location is denied, without rewriting the saved choice", async () => {
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));
    const saved = { useLocation: true, method: 2, city: { name: "Chicago", country: "US", lat: 41.88, lng: -87.63 } };
    await AsyncStorage.setItem("prayerSettings", JSON.stringify(saved));
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });
    mockGetPrayerTimesToday.mockResolvedValue(dayOf([{ label: "Fajr", time: "5:00 AM" }]));
    jest.spyOn(AppState, "addEventListener").mockImplementation((() => ({ remove: jest.fn() })) as any);

    const { result } = renderHook(() => useHomePrayerTimes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.locationLabel).toBe("Chicago");
    expect(JSON.parse((await AsyncStorage.getItem("prayerSettings"))!)).toEqual(saved);
    expect(await AsyncStorage.getItem("sync:settings_meta_v1")).toBeNull();
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
  });

  it("reloads when prayer settings change and on app foreground", async () => {
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));

    mockGetPrayerTimesToday.mockResolvedValue(dayOf([
      { label: "Fajr", time: "5:00 AM" },
      { label: "Dhuhr", time: "12:00 PM" },
      { label: "Isha", time: "8:00 PM" },
    ]));

    let appStateListener: ((state: string) => void | Promise<void>) | null = null;

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
      await prayerSettingsSetting.set({ useLocation: false, method: 3, city: null });
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

    mockGetPrayerTimesToday.mockResolvedValueOnce(dayOf([
      { label: "Fajr", time: "5:00 AM" },
      { label: "Dhuhr", time: "12:00 PM" },
      { label: "Isha", time: "8:00 PM" },
    ]));
    mockGetPrayerTimesForDate.mockResolvedValueOnce(dayOf([
      { label: "Fajr", time: "5:10 AM" },
      { label: "Dhuhr", time: "12:05 PM" },
    ]));

    const { result } = renderHook(() => useHomePrayerTimes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(formatClock(result.current.nextDayFajr!)).toBe("5:10 AM");
    });

    expect(result.current.locationLabel).toBe("Chicago");
    expect(mockGetPrayerTimesToday).toHaveBeenCalledTimes(1);
    expect(mockGetPrayerTimesForDate.mock.calls[0][1].getDate()).toBe(26);
  });

  describe("location label fallback (useLocation: true)", () => {
    beforeEach(async () => {
      freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));
      await AsyncStorage.setItem(
        "prayerSettings",
        JSON.stringify({ useLocation: true, method: 2, city: null }),
      );
      mockGetPrayerTimesToday.mockResolvedValue(dayOf([
        { label: "Fajr", time: "5:00 AM" },
        { label: "Dhuhr", time: "12:00 PM" },
        { label: "Isha", time: "8:00 PM" },
      ]));
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
