import { act, renderHook } from "@testing-library/react-native";

import { useNextPrayer } from "@/hooks/useNextPrayer";
import { dateKeyFromDate } from "@/services/holidayService";
import type { PrayerTime } from "@/services/prayerTimes";
import getTimeUntil from "@/utils/getTimeUntil";

jest.mock("@/utils/getTimeUntil", () => ({
  __esModule: true,
  default: jest.fn(() => "0s"),
}));

const mockGetTimeUntil = getTimeUntil as jest.MockedFunction<typeof getTimeUntil>;

const PRAYER_TIMES: PrayerTime[] = [
  { label: "Fajr", time: "5:00 AM" },
  { label: "Dhuhr", time: "12:00 PM" },
  { label: "Asr", time: "3:30 PM" },
  { label: "Maghrib", time: "6:10 PM" },
  { label: "Isha", time: "8:00 PM" },
];

describe("useNextPrayer", () => {
  afterEach(() => {
    jest.clearAllMocks();
    resetTestTime();
  });

  it("selects the next upcoming prayer for today when date key matches", () => {
    freezeTestTime(new Date(2026, 1, 25, 10, 15, 0));
    mockGetTimeUntil.mockReturnValue("1h 45m 0s");

    const selectedDate = new Date(2026, 1, 25);

    const { result } = renderHook(() =>
      useNextPrayer(selectedDate, PRAYER_TIMES, dateKeyFromDate(selectedDate)),
    );

    expect(result.current.nextPrayer).not.toBeNull();
    expect(result.current.nextPrayer?.label).toBe("Dhuhr");
    expect(result.current.nextPrayer?.time).toBe("12:00 PM");
    expect(result.current.nextPrayer?.dateObj.toDateString()).toBe(
      selectedDate.toDateString(),
    );
    expect(result.current.nextPrayer?.dateObj.getHours()).toBe(12);
    expect(result.current.nextPrayer?.dateObj.getMinutes()).toBe(0);
    expect(result.current.timeLeft).toBe("1h 45m 0s");
  });

  it("returns null/empty when selectedDate is missing, not today, or no prayers remain", () => {
    freezeTestTime(new Date(2026, 1, 25, 23, 30, 0));
    const today = new Date(2026, 1, 25);
    const tomorrow = new Date(2026, 1, 26);

    const { result, rerender } = renderHook(
      ({
        selectedDate,
        prayerTimes,
        dateKey,
      }: {
        selectedDate: Date | null;
        prayerTimes: PrayerTime[];
        dateKey: string | null;
      }) => useNextPrayer(selectedDate, prayerTimes, dateKey),
      {
        initialProps: {
          selectedDate: null,
          prayerTimes: PRAYER_TIMES,
          dateKey: null,
        },
      },
    );

    expect(result.current.nextPrayer).toBeNull();
    expect(result.current.timeLeft).toBe("");

    rerender({
      selectedDate: tomorrow,
      prayerTimes: PRAYER_TIMES,
      dateKey: dateKeyFromDate(tomorrow),
    });

    expect(result.current.nextPrayer).toBeNull();
    expect(result.current.timeLeft).toBe("");

    rerender({
      selectedDate: today,
      prayerTimes: [
        { label: "Fajr", time: "5:00 AM" },
        { label: "Isha", time: "8:00 PM" },
      ],
      dateKey: dateKeyFromDate(today),
    });

    expect(result.current.nextPrayer).toBeNull();
    expect(result.current.timeLeft).toBe("");
  });

  it("guards against stale prayer data when date keys do not match", () => {
    freezeTestTime(new Date(2026, 1, 25, 10, 15, 0));
    const selectedDate = new Date(2026, 1, 25);

    const { result } = renderHook(() =>
      useNextPrayer(selectedDate, PRAYER_TIMES, "2026-02-24"),
    );

    expect(result.current.nextPrayer).toBeNull();
    expect(result.current.timeLeft).toBe("");
    expect(mockGetTimeUntil).not.toHaveBeenCalled();
  });

  it("updates timeLeft on interval ticks and stops after unmount", () => {
    freezeTestTime(new Date(2026, 1, 25, 11, 59, 55));
    const selectedDate = new Date(2026, 1, 25);

    mockGetTimeUntil
      .mockReturnValueOnce("5s")
      .mockReturnValueOnce("4s")
      .mockReturnValueOnce("3s");

    const { result, unmount } = renderHook(() =>
      useNextPrayer(selectedDate, PRAYER_TIMES, dateKeyFromDate(selectedDate)),
    );

    expect(result.current.timeLeft).toBe("5s");
    expect(mockGetTimeUntil).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.timeLeft).toBe("3s");
    expect(mockGetTimeUntil).toHaveBeenCalledTimes(3);

    unmount();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(mockGetTimeUntil).toHaveBeenCalledTimes(3);
  });
});
