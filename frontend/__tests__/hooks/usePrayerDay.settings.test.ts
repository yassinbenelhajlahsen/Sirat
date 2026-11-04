import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { usePrayerDay } from "@/hooks/usePrayerDay";
import { buildPrayerDay } from "@/services/prayerDay";
import { getPrayerTimesForDate } from "@/services/prayerTimes";
import { prayerSettingsSetting } from "@/services/syncedSettings";

jest.mock("expo-location", () => ({
  hasServicesEnabledAsync: jest.fn(async () => true),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
}));

jest.mock("@/services/prayerTimes", () => ({
  getPrayerTimesForDate: jest.fn(),
}));

const mockGetPrayerTimesForDate = getPrayerTimesForDate as jest.MockedFunction<typeof getPrayerTimesForDate>;
// One Date instance: the hook reloads whenever the date object changes.
const day = new Date(2026, 1, 25);
const chicago = { name: "Chicago", country: "US", lat: 41.88, lng: -87.63 };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockGetPrayerTimesForDate.mockResolvedValue(buildPrayerDay(day, [{ label: "Fajr", time: "5:00 AM" }]));
});

describe("usePrayerDay with the user's prayer settings", () => {
  it("loads the day with the saved method and city", async () => {
    await AsyncStorage.setItem(
      "prayerSettings",
      JSON.stringify({ useLocation: false, method: 5, city: chicago }),
    );

    renderHook(() => usePrayerDay(day));

    await waitFor(() => expect(mockGetPrayerTimesForDate).toHaveBeenCalled());
    expect(mockGetPrayerTimesForDate.mock.calls[0][0]).toEqual({
      useLocation: false,
      method: 5,
      city: chicago,
    });
  });

  it("reloads the day when the prayer settings change", async () => {
    renderHook(() => usePrayerDay(day));
    await waitFor(() => expect(mockGetPrayerTimesForDate).toHaveBeenCalledTimes(1));

    await act(async () => {
      await prayerSettingsSetting.set({ useLocation: true, method: 3, city: null });
    });

    await waitFor(() => expect(mockGetPrayerTimesForDate).toHaveBeenCalledTimes(2));
    expect(mockGetPrayerTimesForDate.mock.calls[1][0]).toMatchObject({ method: 3 });
  });
});
