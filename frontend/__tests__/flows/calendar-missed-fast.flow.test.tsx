import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useCalendarData } from "@/hooks/useCalendarData";
import { useRamadanTracker } from "@/hooks/useRamadanTracker";
import { getHolidayMapForYear, getHolidaysForYear } from "@/services/holidayService";

let triggerFocusEffect: (() => void) | null = null;

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void) => {
    triggerFocusEffect = cb;
  },
}));

jest.mock("@/services/holidayService", () => ({
  getHolidayMapForYear: jest.fn(),
  getHolidaysForYear: jest.fn(),
}));

const mockGetHolidayMapForYear = getHolidayMapForYear as jest.MockedFunction<
  typeof getHolidayMapForYear
>;
const mockGetHolidaysForYear = getHolidaysForYear as jest.MockedFunction<
  typeof getHolidaysForYear
>;

describe("flows/calendar-missed-fast", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    triggerFocusEffect = null;
  });

  it("updates calendar Ramadan summary after toggling missed fast state", async () => {
    mockGetHolidayMapForYear.mockResolvedValue({
      "2026-02-20": "1st day of Ramadan",
    });
    mockGetHolidaysForYear.mockResolvedValue([
      { date: "2026-02-20", name: "1st day of Ramadan" },
    ]);

    const calendar = renderHook(() => useCalendarData(2026, 1));

    await waitFor(() => {
      expect(calendar.result.current.loadingHolidays).toBe(false);
      expect(calendar.result.current.ramadanMonthActive).toBe(true);
      expect(calendar.result.current.showRamadanSummary).toBe(false);
    });

    const selectedDate = new Date(2026, 1, 24);
    const tracker = renderHook(() =>
      useRamadanTracker(selectedDate, undefined, undefined),
    );

    await waitFor(() => {
      expect(tracker.result.current.loadingRamadan).toBe(false);
      expect(tracker.result.current.isRamadan).toBe(true);
      expect(tracker.result.current.isFastMissed).toBe(false);
    });

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

  it("transitions holiday loading into error-safe fallback state", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    mockGetHolidayMapForYear.mockRejectedValueOnce(new Error("holiday backend down"));
    mockGetHolidaysForYear.mockRejectedValueOnce(new Error("holiday backend down"));

    const { result } = renderHook(() => useCalendarData(2026, 1));

    await waitFor(() => {
      expect(result.current.loadingHolidays).toBe(false);
    });

    expect(result.current.holidayMap).toEqual({});
    expect(result.current.ramadanMonthActive).toBe(false);
    expect(result.current.ramadanStart).toBeNull();
    expect(result.current.ramadanEnd).toBeNull();
    expect(result.current.showRamadanSummary).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
  });
});
