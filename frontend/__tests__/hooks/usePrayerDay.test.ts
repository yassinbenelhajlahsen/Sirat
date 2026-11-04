import { renderHook, waitFor, act } from "@testing-library/react-native";

import { usePrayerDay } from "@/hooks/usePrayerDay";
import { LocationUnavailableError } from "@/services/prayer-times/errors";
import { buildPrayerDay } from "@/services/prayerDay";

jest.mock("@/services/prayerTimes", () => ({
  getPrayerTimesForDate: jest.fn(),
}));

import { getPrayerTimesForDate } from "@/services/prayerTimes";

const mockGetPrayerTimesForDate = getPrayerTimesForDate as jest.MockedFunction<
  typeof getPrayerTimesForDate
>;

describe("usePrayerDay", () => {
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
      .mockResolvedValueOnce(buildPrayerDay(selectedDate, [{ label: "Fajr", time: "5:00 AM" }]));

    const setTimeoutSpy = jest.spyOn(global, "setTimeout");

    const { result } = renderHook(() => usePrayerDay(selectedDate));

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
      expect(result.current.prayerDay?.slots.map((x) => x.name)).toEqual(["Fajr"]);
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  it("gives up after three retries and shows the banner", async () => {
    const selectedDate = new Date(2026, 1, 25);
    mockGetPrayerTimesForDate.mockRejectedValue(new Error("Failed to fetch"));

    const { result } = renderHook(() => usePrayerDay(selectedDate));

    for (const wait of [2000, 4000, 8000]) {
      await waitFor(() => expect(mockGetPrayerTimesForDate).toHaveBeenCalled());
      expect(result.current.error).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(wait);
      });
    }

    await waitFor(() => expect(result.current.error?.code).toBe("GENERIC"));
    expect(mockGetPrayerTimesForDate).toHaveBeenCalledTimes(4);
    expect(result.current.loading).toBe(false);
    expect(result.current.prayerDay).toBeNull();
  });

  it("shows a location error with Open Settings and does not retry", async () => {
    const selectedDate = new Date(2026, 1, 25);
    mockGetPrayerTimesForDate.mockRejectedValueOnce(new LocationUnavailableError());

    const setTimeoutSpy = jest.spyOn(global, "setTimeout");

    const { result } = renderHook(() => usePrayerDay(selectedDate));

    await waitFor(() => {
      expect(result.current.error?.code).toBe("LOCATION");
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.prayerDay).toBeNull();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("classifies non-transient failures as GENERIC without retrying", async () => {
    const selectedDate = new Date(2026, 1, 25);
    mockGetPrayerTimesForDate.mockRejectedValueOnce(new Error("unexpected failure"));

    const { result } = renderHook(() => usePrayerDay(selectedDate));

    await waitFor(() => {
      expect(result.current.error?.code).toBe("GENERIC");
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.prayerDay).toBeNull();
    expect(mockGetPrayerTimesForDate).toHaveBeenCalledTimes(1);
  });
});
