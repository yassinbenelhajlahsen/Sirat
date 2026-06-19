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
  fajr: s, dhuhr: s, asr: s, maghrib: s, isha: s,
});

describe("tracking/stats prayer", () => {
  it("addDaysKey shifts a local date key", () => {
    expect(addDaysKey("2026-06-19", -1)).toBe("2026-06-18");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("isDayComplete requires all five non-missed", () => {
    expect(isDayComplete(full("prayed"))).toBe(true);
    expect(isDayComplete({ ...full("prayed"), isha: "missed" })).toBe(false);
    expect(isDayComplete({ fajr: "prayed" })).toBe(false);
    expect(isDayComplete(undefined)).toBe(false);
  });

  it("prayerStreak counts back, late still counts, missed breaks", () => {
    const days = {
      "2026-06-19": full("prayed"),
      "2026-06-18": full("late"),
      "2026-06-17": full("prayed"),
      "2026-06-16": { ...full("prayed"), asr: "missed" as PrayerStatus },
      "2026-06-15": full("prayed"),
    };
    expect(prayerStreak(days, "2026-06-19")).toBe(3);
  });

  it("prayerStreak does not penalize an incomplete today", () => {
    const days = {
      "2026-06-18": full("prayed"),
      "2026-06-17": full("prayed"),
      "2026-06-19": { fajr: "prayed" as PrayerStatus },
    };
    expect(prayerStreak(days, "2026-06-19")).toBe(2);
  });

  it("monthlyCompletion is fraction of non-missed logged slots", () => {
    const days = {
      "2026-06-01": full("prayed"),
      "2026-06-02": { ...full("prayed"), isha: "missed" as PrayerStatus },
    };
    const r = monthlyCompletion(days, 2026, 5);
    expect(r.overall).toBeCloseTo(9 / 10, 5);
    expect(r.byPrayer.isha).toBeCloseTo(1 / 2, 5);
    expect(r.byPrayer.fajr).toBeCloseTo(2 / 2, 5);
  });

  it("qadaCount totals missed prayers", () => {
    const days = {
      "2026-06-01": { ...full("prayed"), isha: "missed" as PrayerStatus },
      "2026-06-02": { fajr: "missed" as PrayerStatus, dhuhr: "missed" as PrayerStatus },
    };
    expect(qadaCount(days)).toBe(3);
  });

  it("unwrapPrayerLog strips cells", () => {
    expect(
      unwrapPrayerLog({ "2026-06-01": { fajr: { value: "prayed", updatedAt: 1 } } }),
    ).toEqual({ "2026-06-01": { fajr: "prayed" } });
  });
});
