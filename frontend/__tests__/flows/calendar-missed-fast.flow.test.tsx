import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useCalendarData } from "@/hooks/useCalendarData";
import { useRamadanTracker } from "@/hooks/useRamadanTracker";
import { getHolidayMapForYear } from "@/services/holidayService";

let triggerFocusEffect: (() => void) | null = null;

jest.mock("expo-router/react-navigation", () => ({
  useFocusEffect: (cb: () => void) => {
    triggerFocusEffect = cb;
  },
}));

jest.mock("@/services/holidayService", () => ({
  getHolidayMapForYear: jest.fn(),
}));

const mockGetHolidayMapForYear = getHolidayMapForYear as jest.MockedFunction<
  typeof getHolidayMapForYear
>;

describe("flows/calendar-missed-fast", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    triggerFocusEffect = null;
  });

  it("updates calendar Ramadan summary after toggling missed fast state", async () => {
    mockGetHolidayMapForYear.mockResolvedValue({});

    const calendar = renderHook(() => useCalendarData(2026, 1));

    await waitFor(() => {
      expect(calendar.result.current.loadingHolidays).toBe(false);
      expect(calendar.result.current.ramadanMonthActive).toBe(true);
      expect(calendar.result.current.showRamadanSummary).toBe(false);
    });

    const selectedDate = new Date(2026, 1, 24);
    const tracker = renderHook(() => useRamadanTracker(selectedDate));
    expect(tracker.result.current.isRamadan).toBe(true);
    expect(tracker.result.current.isFastMissed).toBe(false);

    await act(async () => {
      await tracker.result.current.toggleMissedFast();
    });

    const storedAfterMark = await AsyncStorage.getItem("ramadan_tracker_v1");
    expect(storedAfterMark ? JSON.parse(storedAfterMark) : {}).toEqual({
      "2026-02-24": true,
    });
    expect(tracker.result.current.isFastMissed).toBe(true);

    act(() => {
      triggerFocusEffect?.();
    });

    await waitFor(() => {
      expect(calendar.result.current.showRamadanSummary).toBe(true);
      expect(calendar.result.current.firstMissedFastDate).toEqual(
        new Date(2026, 1, 24),
      );
    });
    expect(calendar.result.current.missedDaysLabel).toContain("Feb");

    await act(async () => {
      await tracker.result.current.toggleMissedFast();
    });

    const storedAfterClear = await AsyncStorage.getItem("ramadan_tracker_v1");
    expect(storedAfterClear ? JSON.parse(storedAfterClear) : {}).toEqual({});
    expect(tracker.result.current.isFastMissed).toBe(false);

    act(() => {
      triggerFocusEffect?.();
    });

    await waitFor(() => {
      expect(calendar.result.current.showRamadanSummary).toBe(false);
      expect(calendar.result.current.missedDaysLabel).toBe("");
    });
  });

  it("falls back to no holidays when the feed is down, and Ramadan still works", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    mockGetHolidayMapForYear.mockRejectedValueOnce(new Error("holiday backend down"));

    const { result } = renderHook(() => useCalendarData(2026, 1));

    await waitFor(() => {
      expect(result.current.loadingHolidays).toBe(false);
    });

    expect(result.current.holidayMap).toEqual({});
    expect(result.current.ramadanMonthActive).toBe(true);
    expect(result.current.showRamadanSummary).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
