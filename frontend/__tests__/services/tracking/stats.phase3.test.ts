import { unwrapHabitLog, monthDailyScores } from "@/services/tracking/stats";

describe("unwrapHabitLog", () => {
  it("strips Cell wrappers to plain booleans", () => {
    const out = unwrapHabitLog({
      "2026-06-19": {
        h1: { value: true, updatedAt: 1 },
        h2: { value: false, updatedAt: 2 },
      },
    });
    expect(out).toEqual({ "2026-06-19": { h1: true, h2: false } });
  });
});

describe("monthDailyScores", () => {
  it("returns a non-missed fraction per day of the month", () => {
    const byDay = {
      "2026-06-01": { fajr: "prayed", dhuhr: "prayed", asr: "prayed", maghrib: "prayed", isha: "late" },
      "2026-06-02": { fajr: "prayed", dhuhr: "missed", asr: "prayed" },
    } as const;
    const scores = monthDailyScores(byDay as any, 2026, 5); // June (0-indexed)
    expect(scores).toHaveLength(30);
    expect(scores[0]).toBe(1); // 5/5 non-missed
    expect(scores[1]).toBeCloseTo(2 / 5); // 2 non-missed of 5
    expect(scores[2]).toBe(0); // no log
  });
});
