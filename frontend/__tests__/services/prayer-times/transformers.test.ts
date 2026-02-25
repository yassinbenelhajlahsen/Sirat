import {
  dateKey,
  formatTo12Hour,
  mapTimingsToPrayerTimes,
  mergeCalendarDayIntoStore,
} from "@/services/prayer-times/transformers";

describe("prayer-times/transformers", () => {
  it("formats a date key in local yyyy-mm-dd", () => {
    const d = new Date(2026, 1, 3, 9, 15, 0);
    expect(dateKey(d)).toBe("2026-02-03");
  });

  it("formats 24h timings to 12h and strips suffix payload", () => {
    expect(formatTo12Hour("00:05")).toBe("12:05 AM");
    expect(formatTo12Hour("12:00")).toBe("12:00 PM");
    expect(formatTo12Hour("13:45")).toBe("1:45 PM");
    expect(formatTo12Hour("05:30 (+03)")) .toBe("5:30 AM");
  });

  it("maps backend timing map to ordered prayer list", () => {
    const mapped = mapTimingsToPrayerTimes({
      Fajr: "05:00",
      Sunrise: "06:20",
      Dhuhr: "12:10",
      Asr: "15:30",
      Maghrib: "18:00",
      Isha: "19:30",
    });

    expect(mapped.map((p) => p.label)).toEqual([
      "Fajr",
      "Sunrise",
      "Dhuhr",
      "Asr",
      "Maghrib",
      "Isha",
    ]);
    expect(mapped[0].time).toBe("5:00 AM");
    expect(mapped[5].time).toBe("7:30 PM");
  });

  it("merges valid calendar days and ignores malformed entries", () => {
    const store: Record<string, { label: string; time: string }[]> = {};

    mergeCalendarDayIntoStore(store, {
      date: { gregorian: { date: "03-02-2026" } },
      timings: {
        Fajr: "05:00",
        Sunrise: "06:20",
        Dhuhr: "12:10",
        Asr: "15:30",
        Maghrib: "18:00",
        Isha: "19:30",
      },
    });

    mergeCalendarDayIntoStore(store, {
      date: { gregorian: { date: "bad" } },
      timings: undefined as any,
    });

    expect(store["2026-02-03"]).toBeTruthy();
    expect(store["2026-02-03"][0]).toEqual({ label: "Fajr", time: "5:00 AM" });
    expect(Object.keys(store)).toEqual(["2026-02-03"]);
  });
});
