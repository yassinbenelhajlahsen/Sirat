import { renderHook, waitFor, act } from "@testing-library/react-native";

import { usePrayerTimes } from "@/hooks/usePrayerTimes";

jest.mock("@/services/prayerTimes", () => ({
  getPrayerTimesForDate: jest.fn(),
}));

import { getPrayerTimesForDate } from "@/services/prayerTimes";

const mockGetPrayerTimesForDate = getPrayerTimesForDate as jest.MockedFunction<
  typeof getPrayerTimesForDate
>;

describe("usePrayerTimes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Math, "random").mockReturnValue(0);
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    (Math.random as jest.Mock).mockRestore?.();
    (console.warn as jest.Mock).mockRestore?.();
    jest.useRealTimers();
  });

  it("retries transient failures with backoff and eventually resolves", async () => {
    const selectedDate = new Date(2026, 1, 25);

    mockGetPrayerTimesForDate
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce([{ label: "Fajr", time: "5:00 AM" }]);

    const setTimeoutSpy = jest.spyOn(global, "setTimeout");

    const { result } = renderHook(() => usePrayerTimes(selectedDate));

    await waitFor(() => {
      expect(mockGetPrayerTimesForDate).toHaveBeenCalledTimes(1);
    });

    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(setTimeoutSpy.mock.calls[0]?.[1]).toBe(2000);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(mockGetPrayerTimesForDate).toHaveBeenCalledTimes(2);
      expect(result.current.prayerTimes).toEqual([{ label: "Fajr", time: "5:00 AM" }]);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  it("classifies location permission errors as PERMISSION without retrying", async () => {
    const selectedDate = new Date(2026, 1, 25);
    mockGetPrayerTimesForDate.mockRejectedValueOnce(
      new Error("Location permission not granted"),
    );

    const setTimeoutSpy = jest.spyOn(global, "setTimeout");

    const { result } = renderHook(() => usePrayerTimes(selectedDate));

    await waitFor(() => {
      expect(result.current.error?.code).toBe("PERMISSION");
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.prayerTimes).toEqual([]);
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("classifies non-transient failures as GENERIC", async () => {
    const selectedDate = new Date(2026, 1, 25);
    mockGetPrayerTimesForDate.mockRejectedValueOnce(new Error("unexpected failure"));

    const { result } = renderHook(() => usePrayerTimes(selectedDate));

    await waitFor(() => {
      expect(result.current.error).toEqual({
        code: "GENERIC",
        message: "Could not load prayer times. Please try again later.",
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.prayerTimes).toEqual([]);
  });
});
