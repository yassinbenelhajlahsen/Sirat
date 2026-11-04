import { act, renderHook } from "@testing-library/react-native";

import { useNextPrayer } from "@/hooks/useNextPrayer";
import { buildPrayerDay } from "@/services/prayerDay";
import getTimeUntil from "@/utils/getTimeUntil";

jest.mock("@/utils/getTimeUntil", () => ({
  __esModule: true,
  default: jest.fn(() => "0s"),
}));

const mockGetTimeUntil = getTimeUntil as jest.MockedFunction<typeof getTimeUntil>;

const ROWS = [
  { label: "Fajr", time: "5:00 AM" },
  { label: "Dhuhr", time: "12:00 PM" },
  { label: "Asr", time: "3:30 PM" },
  { label: "Maghrib", time: "6:10 PM" },
  { label: "Isha", time: "8:00 PM" },
];

const dayOf = (date: Date, rows = ROWS) => buildPrayerDay(date, rows);

describe("useNextPrayer", () => {
  afterEach(() => {
    jest.clearAllMocks();
    resetTestTime();
  });

  it("selects the next upcoming prayer for today", () => {
    freezeTestTime(new Date(2026, 1, 25, 10, 15, 0));
    mockGetTimeUntil.mockReturnValue("1h 45m 0s");

    const day = dayOf(new Date(2026, 1, 25));
    const { result } = renderHook(() => useNextPrayer(day));

    expect(result.current.nextPrayer?.name).toBe("Dhuhr");
    expect(result.current.nextPrayer?.at.getHours()).toBe(12);
    expect(result.current.nextPrayer?.at.getMinutes()).toBe(0);
    expect(result.current.timeLeft).toBe("1h 45m 0s");
  });

  it("returns null/empty when there is no day, it is not today, or no prayers remain", () => {
    freezeTestTime(new Date(2026, 1, 25, 23, 30, 0));

    const { result, rerender } = renderHook(
      ({ day }: { day: ReturnType<typeof dayOf> | null }) => useNextPrayer(day),
      { initialProps: { day: null as ReturnType<typeof dayOf> | null } },
    );

    expect(result.current.nextPrayer).toBeNull();
    expect(result.current.timeLeft).toBe("");

    rerender({ day: dayOf(new Date(2026, 1, 26)) });
    expect(result.current.nextPrayer).toBeNull();
    expect(result.current.timeLeft).toBe("");

    rerender({
      day: dayOf(new Date(2026, 1, 25), [
        { label: "Fajr", time: "5:00 AM" },
        { label: "Isha", time: "8:00 PM" },
      ]),
    });
    expect(result.current.nextPrayer).toBeNull();
    expect(result.current.timeLeft).toBe("");
  });

  it("ignores a day that is not today even if prayers are still ahead", () => {
    freezeTestTime(new Date(2026, 1, 25, 10, 15, 0));
    const { result } = renderHook(() => useNextPrayer(dayOf(new Date(2026, 1, 24))));

    expect(result.current.nextPrayer).toBeNull();
    expect(result.current.timeLeft).toBe("");
    expect(mockGetTimeUntil).not.toHaveBeenCalled();
  });

  it("updates timeLeft on interval ticks and stops after unmount", () => {
    freezeTestTime(new Date(2026, 1, 25, 11, 59, 55));
    const day = dayOf(new Date(2026, 1, 25));

    mockGetTimeUntil
      .mockReturnValueOnce("5s")
      .mockReturnValueOnce("4s")
      .mockReturnValueOnce("3s");

    const { result, unmount } = renderHook(() => useNextPrayer(day));

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
