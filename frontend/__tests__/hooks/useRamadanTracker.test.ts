import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useRamadanTracker } from "@/hooks/useRamadanTracker";

jest.mock("@/services/holidayService", () => ({
  getHolidaysForYear: jest.fn(),
}));

jest.mock("@/services/ramadanTracker", () => ({
  clearMissedFast: jest.fn(),
  computeRamadanEnd: jest.fn(),
  dateKey: jest.requireActual("@/services/ramadanTracker").dateKey,
  findRamadanStart: jest.fn(),
  isInRamadanWindow: jest.fn(),
  markFastAsMissed: jest.fn(),
}));

import { getHolidaysForYear } from "@/services/holidayService";
import { ramadanTrackerSetting } from "@/services/syncedSettings";
import {
  clearMissedFast,
  computeRamadanEnd,
  findRamadanStart,
  isInRamadanWindow,
  markFastAsMissed,
} from "@/services/ramadanTracker";

const mockGetHolidaysForYear = getHolidaysForYear as jest.MockedFunction<
  typeof getHolidaysForYear
>;
const mockClearMissedFast = clearMissedFast as jest.MockedFunction<typeof clearMissedFast>;
const mockComputeRamadanEnd = computeRamadanEnd as jest.MockedFunction<typeof computeRamadanEnd>;
const mockFindRamadanStart = findRamadanStart as jest.MockedFunction<typeof findRamadanStart>;
const mockIsInRamadanWindow = isInRamadanWindow as jest.MockedFunction<
  typeof isInRamadanWindow
>;
const mockMarkFastAsMissed = markFastAsMissed as jest.MockedFunction<typeof markFastAsMissed>;

describe("hooks/useRamadanTracker", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("loads ramadan range from holidays when params are missing and toggles missed fast", async () => {
    const selectedDate = new Date(2026, 1, 28);
    const start = new Date(2026, 1, 20);
    const end = new Date(2026, 2, 21);

    // The mocked service writes through the real setting, as the real one does.
    mockMarkFastAsMissed.mockImplementation(async () => {
      await ramadanTrackerSetting.set({ "2026-02-28": true });
    });
    mockClearMissedFast.mockImplementation(async () => {
      await ramadanTrackerSetting.set({});
    });
    mockGetHolidaysForYear.mockResolvedValue([{ date: "2026-02-20", name: "1st day of Ramadan" }]);
    mockFindRamadanStart.mockReturnValue(start);
    mockComputeRamadanEnd.mockReturnValue(end);
    mockIsInRamadanWindow.mockReturnValue(true);

    const { result } = renderHook(() => useRamadanTracker(selectedDate, undefined, undefined));

    await waitFor(() => {
      expect(result.current.loadingRamadan).toBe(false);
      expect(result.current.isRamadan).toBe(true);
      expect(result.current.isFastMissed).toBe(false);
    });

    await act(async () => {
      await result.current.toggleMissedFast();
    });

    expect(mockMarkFastAsMissed).toHaveBeenCalledWith(selectedDate);
    expect(result.current.isFastMissed).toBe(true);

    await act(async () => {
      await result.current.toggleMissedFast();
    });

    expect(mockClearMissedFast).toHaveBeenCalledWith(selectedDate);
    expect(result.current.isFastMissed).toBe(false);
  });
});
