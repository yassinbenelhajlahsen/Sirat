import { habitStreak, weekKey } from "@/services/tracking/stats";

describe("tracking/stats habit", () => {
  it("weekKey groups consecutive days into the same Sunday-started week", () => {
    // 2026-06-14 is a Sunday; 2026-06-20 is the following Saturday.
    expect(weekKey("2026-06-14")).toBe(weekKey("2026-06-20"));
    expect(weekKey("2026-06-14")).not.toBe(weekKey("2026-06-21"));
  });

  it("daily streak counts consecutive done days, today not penalized", () => {
    const done = {
      "2026-06-18": { h1: true },
      "2026-06-17": { h1: true },
      "2026-06-16": { h1: false },
    };
    expect(habitStreak({ frequency: { type: "daily" } }, done, "h1", "2026-06-19")).toBe(2);
  });

  it("daily streak counts today when done", () => {
    const done = { "2026-06-19": { h1: true }, "2026-06-18": { h1: true } };
    expect(habitStreak({ frequency: { type: "daily" } }, done, "h1", "2026-06-19")).toBe(2);
  });

  it("weekly streak counts weeks meeting the target", () => {
    // target 3x/week. Two full prior weeks meet it; current week has 1 so far (not penalized).
    const done = {
      // week of Jun 14-20 (current, today=Jun19): 1 done
      "2026-06-15": { h1: true },
      // week of Jun 7-13: 3 done
      "2026-06-08": { h1: true }, "2026-06-09": { h1: true }, "2026-06-10": { h1: true },
      // week of May 31-Jun 6: 3 done
      "2026-06-01": { h1: true }, "2026-06-02": { h1: true }, "2026-06-03": { h1: true },
    };
    expect(
      habitStreak({ frequency: { type: "weekly", timesPerWeek: 3 } }, done, "h1", "2026-06-19"),
    ).toBe(2);
  });
});
