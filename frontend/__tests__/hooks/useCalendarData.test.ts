import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, waitFor } from "@testing-library/react-native";

import { useCalendarData } from "@/hooks/useCalendarData";

jest.mock("@/services/holidayService", () => ({
  getHolidayMapForYear: jest.fn(),
  getHolidaysForYear: jest.fn(),
}));

jest.mock("@/services/ramadanTracker", () => ({
  computeRamadanEnd: jest.fn(),
  findRamadanStart: jest.fn(),
  getRamadanPeriodSummary: jest.fn(),
  isInRamadanWindow: jest.fn(),
}));

import { getHolidayMapForYear, getHolidaysForYear } from "@/services/holidayService";
import {
  computeRamadanEnd,
  findRamadanStart,
  getRamadanPeriodSummary,
  isInRamadanWindow,
} from "@/services/ramadanTracker";

const mockGetHolidayMapForYear = getHolidayMapForYear as jest.MockedFunction<
  typeof getHolidayMapForYear
>;
const mockGetHolidaysForYear = getHolidaysForYear as jest.MockedFunction<
  typeof getHolidaysForYear
>;
const mockComputeRamadanEnd = computeRamadanEnd as jest.MockedFunction<typeof computeRamadanEnd>;
const mockFindRamadanStart = findRamadanStart as jest.MockedFunction<typeof findRamadanStart>;
const mockGetRamadanPeriodSummary = getRamadanPeriodSummary as jest.MockedFunction<
  typeof getRamadanPeriodSummary
>;
const mockIsInRamadanWindow = isInRamadanWindow as jest.MockedFunction<
  typeof isInRamadanWindow
>;

describe("hooks/useCalendarData", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("loads holiday map, Ramadan window state, and summary labels from service layer", async () => {
    const start = new Date(2026, 1, 20);
    const end = new Date(2026, 2, 21);
    const missedMap = {
      "2026-02-10": true,
      "2026-02-24": true,
      "2026-03-01": true,
    };

    mockGetHolidayMapForYear.mockResolvedValue({ "2026-02-20": "1st day of Ramadan" });
    mockGetHolidaysForYear.mockResolvedValue([{ date: "2026-02-20", name: "1st day of Ramadan" }]);
    await AsyncStorage.setItem("ramadan_tracker_v1", JSON.stringify(missedMap));
    mockFindRamadanStart.mockReturnValue(start);
    mockComputeRamadanEnd.mockReturnValue(end);
    mockIsInRamadanWindow.mockReturnValue(true);
    mockGetRamadanPeriodSummary.mockReturnValue({
      totalMissed: 2,
      missedDays: ["Feb 24", "Mar 1"],
    });

    const { result } = renderHook(() => useCalendarData(2026, 1));

    await waitFor(() => {
      expect(result.current.loadingHolidays).toBe(false);
      expect(result.current.holidayMap).toEqual({ "2026-02-20": "1st day of Ramadan" });
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
});
