import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, waitFor } from "@testing-library/react-native";

import { useCalendarData } from "@/hooks/useCalendarData";

jest.mock("@/services/holidayService", () => ({
  getHolidayMapForYear: jest.fn(),
}));

import { getHolidayMapForYear } from "@/services/holidayService";

const mockGetHolidayMapForYear = getHolidayMapForYear as jest.MockedFunction<
  typeof getHolidayMapForYear
>;

describe("hooks/useCalendarData", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("loads the holiday map and builds the Ramadan summary from Umm al-Qura", async () => {
    // Ramadan 1447 is Feb 18 to Mar 19, 2026; the first missed day is outside the 3-day window.
    await AsyncStorage.setItem(
      "ramadan_tracker_v1",
      JSON.stringify({ "2026-02-10": true, "2026-02-24": true, "2026-03-01": true }),
    );
    mockGetHolidayMapForYear.mockResolvedValue({ "2026-02-20": "A holiday" });

    const { result } = renderHook(() => useCalendarData(2026, 1));

    await waitFor(() => {
      expect(result.current.loadingHolidays).toBe(false);
      expect(result.current.holidayMap).toEqual({ "2026-02-20": "A holiday" });
      expect(result.current.ramadanMonthActive).toBe(true);
      expect(result.current.ramadanSummary).toEqual({
        totalMissed: 2,
        missedDays: ["Feb 24", "Mar 1"],
      });
      expect(result.current.firstMissedFastDate).toEqual(new Date(2026, 1, 24));
      expect(result.current.missedDaysLabel).toBe("Feb 24, Mar 1");
      expect(result.current.showRamadanSummary).toBe(true);
    });
  });

  it("is inactive in a month that does not touch Ramadan", async () => {
    mockGetHolidayMapForYear.mockResolvedValue({});
    const { result } = renderHook(() => useCalendarData(2026, 5));
    await waitFor(() => expect(result.current.loadingHolidays).toBe(false));
    expect(result.current.ramadanMonthActive).toBe(false);
    expect(result.current.ramadanSummary).toBeNull();
  });
});
