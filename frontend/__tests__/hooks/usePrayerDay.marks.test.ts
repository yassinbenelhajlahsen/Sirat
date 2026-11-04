import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { usePrayerDay } from "@/hooks/usePrayerDay";
import { buildPrayerDay } from "@/services/prayerDay";
import { getPrayerTimesForDate } from "@/services/prayerTimes";
import { getDayStatuses } from "@/services/tracking/prayerLog";

jest.mock("expo-location", () => ({
  hasServicesEnabledAsync: jest.fn(async () => true),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
}));
jest.mock("@/services/prayerTimes", () => ({ getPrayerTimesForDate: jest.fn() }));

const mockGetPrayerTimesForDate = getPrayerTimesForDate as jest.MockedFunction<typeof getPrayerTimesForDate>;
const chicago = { name: "Chicago", country: "US", lat: 41.88, lng: -87.63 };
// One Date instance: the hook reloads whenever the day changes.
const nov3 = new Date(2026, 10, 3);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem("prayerSettings", JSON.stringify({ useLocation: false, method: 2, city: chicago }));
  mockGetPrayerTimesForDate.mockImplementation(async (_s, d) =>
    buildPrayerDay(d, [
      { label: "Fajr", time: "5:25 AM" },
      { label: "Maghrib", time: "4:55 PM" },
    ]),
  );
});

describe("usePrayerDay marks and log sheet", () => {
  it("opens the sheet for a prayer, saves the mark for that day and closes", async () => {
    const { result } = renderHook(() => usePrayerDay(nov3));
    await waitFor(() => expect(result.current.prayerDay).not.toBeNull());
    expect(result.current.logSheet.visible).toBe(false);

    act(() => result.current.openLogSheet("Fajr", "Fajr"));
    expect(result.current.logSheet).toMatchObject({ visible: true, prayerName: "Fajr", prayerLabel: "Fajr" });

    await act(async () => {
      result.current.logSheet.onSelect("prayed");
    });
    expect(result.current.logSheet.visible).toBe(false);
    await waitFor(() => expect(result.current.statuses.Fajr).toBe("prayed"));
    expect(await getDayStatuses("2026-11-03")).toEqual({ Fajr: "prayed" });
  });

  it("clears a mark from the sheet", async () => {
    const { result } = renderHook(() => usePrayerDay(nov3));
    await waitFor(() => expect(result.current.prayerDay).not.toBeNull());

    act(() => result.current.openLogSheet("Fajr", "Fajr"));
    await act(async () => {
      result.current.logSheet.onSelect("late");
    });
    await waitFor(() => expect(result.current.statuses.Fajr).toBe("late"));

    act(() => result.current.openLogSheet("Fajr", "Fajr"));
    expect(result.current.logSheet.currentStatus).toBe("late");
    await act(async () => {
      result.current.logSheet.onClear();
    });
    await waitFor(() => expect(result.current.statuses.Fajr).toBeUndefined());
  });

  it("shows a browsed day's daytime Hijri date", async () => {
    const { result } = renderHook(() => usePrayerDay(nov3));
    await waitFor(() => expect(result.current.prayerDay).not.toBeNull());
    expect(result.current.hijri).toBe("Jumada I 23, 1448 AH");
  });

  it("turns today's Hijri date at Maghrib", async () => {
    freezeTestTime(new Date(2026, 10, 3, 17, 30));
    const { result } = renderHook(() => usePrayerDay(new Date(2026, 10, 3, 17, 30)));
    await waitFor(() => expect(result.current.prayerDay).not.toBeNull());
    expect(result.current.hijri).toBe("Jumada I 24, 1448 AH");
    resetTestTime();
  });
});
