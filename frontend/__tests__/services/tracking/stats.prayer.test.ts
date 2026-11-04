import {
  addDaysKey,
  isDayComplete,
  prayerStreak,
  monthlyCompletion,
  qadaCount,
  unwrapPrayerLog,
} from "@/services/tracking/stats";
import type { PrayerName, PrayerStatus } from "@/services/tracking/types";

const full = (s: PrayerStatus): Partial<Record<PrayerName, PrayerStatus>> => ({
  Fajr: s, Dhuhr: s, Asr: s, Maghrib: s, Isha: s,
});

describe("tracking/stats prayer", () => {
  it("addDaysKey shifts a local date key", () => {
    expect(addDaysKey("2026-06-19", -1)).toBe("2026-06-18");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("isDayComplete requires all five non-missed", () => {
    expect(isDayComplete(full("prayed"))).toBe(true);
    expect(isDayComplete({ ...full("prayed"), Isha: "missed" })).toBe(false);
    expect(isDayComplete({ Fajr: "prayed" })).toBe(false);
    expect(isDayComplete(undefined)).toBe(false);
    expect(isDayComplete(full("late"))).toBe(true);
  });

  it("prayerStreak counts back, late still counts, missed breaks", () => {
    const days = {
      "2026-06-19": full("prayed"),
      "2026-06-18": full("late"),
      "2026-06-17": full("prayed"),
      "2026-06-16": { ...full("prayed"), Asr: "missed" as PrayerStatus },
      "2026-06-15": full("prayed"),
    };
    expect(prayerStreak(days, "2026-06-19")).toBe(3);
  });

  it("prayerStreak does not penalize an incomplete today", () => {
    const days = {
      "2026-06-18": full("prayed"),
      "2026-06-17": full("prayed"),
      "2026-06-19": { Fajr: "prayed" as PrayerStatus },
    };
    expect(prayerStreak(days, "2026-06-19")).toBe(2);
  });

  it("prayerStreak returns zero for empty log", () => {
    expect(prayerStreak({}, "2026-06-19")).toBe(0);
  });

  it("monthlyCompletion is fraction of non-missed logged slots", () => {
    const days = {
      "2026-06-01": full("prayed"),
      "2026-06-02": { ...full("prayed"), Isha: "missed" as PrayerStatus },
    };
    const r = monthlyCompletion(days, 2026, 5);
    expect(r.overall).toBeCloseTo(9 / 10, 5);
    expect(r.byPrayer.Isha).toBeCloseTo(1 / 2, 5);
    expect(r.byPrayer.Fajr).toBeCloseTo(2 / 2, 5);
  });

  it("monthlyCompletion returns zero for empty log", () => {
    const r = monthlyCompletion({}, 2026, 5);
    expect(r.overall).toBe(0);
    expect(r.byPrayer).toEqual({ Fajr: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 });
  });

  it("qadaCount totals missed prayers", () => {
    const days = {
      "2026-06-01": { ...full("prayed"), Isha: "missed" as PrayerStatus },
      "2026-06-02": { Fajr: "missed" as PrayerStatus, Dhuhr: "missed" as PrayerStatus },
    };
    expect(qadaCount(days)).toBe(3);
  });

  it("unwrapPrayerLog strips cells", () => {
    expect(
      unwrapPrayerLog({ "2026-06-01": { fajr: { value: "prayed", updatedAt: 1 } } }),
    ).toEqual({ "2026-06-01": { Fajr: "prayed" } });
  });
});

describe("cleared marks in stats", () => {
  it("unwrapPrayerLog treats a cleared mark as not logged", () => {
    expect(
      unwrapPrayerLog({
        "2026-06-19": { fajr: { value: null, updatedAt: 2 }, dhuhr: { value: "prayed", updatedAt: 1 } },
      }),
    ).toEqual({ "2026-06-19": { Dhuhr: "prayed" } });
  });
});
