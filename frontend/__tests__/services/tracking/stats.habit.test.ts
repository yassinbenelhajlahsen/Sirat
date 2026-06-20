import { habitStreak } from "@/services/tracking/stats";

describe("tracking/stats habit", () => {
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

});

// Helper: weekday index of a YYYY-MM-DD key
const dow = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};

describe("habitStreak (weekday weekly)", () => {
  // June 2026: 1=Mon, 4=Thu, 8=Mon, 11=Thu, 15=Mon, 18=Thu ...
  const mondaysThursdays = { frequency: { type: "weekly" as const, days: [1, 4] } };

  it("counts consecutive scheduled occurrences done, ending today", () => {
    const done = {
      "2026-06-08": { h: true }, // Mon
      "2026-06-11": { h: true }, // Thu
      "2026-06-15": { h: true }, // Mon
    };
    // today = Mon 2026-06-15 (done) -> streak 3
    expect(habitStreak(mondaysThursdays, done, "h", "2026-06-15")).toBe(3);
  });

  it("today scheduled but not done does not break the prior run", () => {
    const done = {
      "2026-06-08": { h: true }, // Mon
      "2026-06-11": { h: true }, // Thu
    };
    // today = Mon 2026-06-15 (NOT done) -> measured from Thu 06-11 -> streak 2
    expect(habitStreak(mondaysThursdays, done, "h", "2026-06-15")).toBe(2);
  });

  it("a missed scheduled occurrence breaks the streak", () => {
    const done = {
      "2026-06-08": { h: true }, // Mon
      // 2026-06-11 Thu missed
      "2026-06-15": { h: true }, // Mon (today, done)
    };
    expect(habitStreak(mondaysThursdays, done, "h", "2026-06-15")).toBe(1);
  });

  it("empty days yields zero", () => {
    expect(habitStreak({ frequency: { type: "weekly", days: [] } }, {}, "h", "2026-06-15")).toBe(0);
  });

  it("ignores done marks on non-scheduled days", () => {
    // sanity: a Wednesday done mark must not count for a Mon/Thu habit
    expect(dow("2026-06-17")).toBe(3); // Wed
    const done = { "2026-06-17": { h: true } };
    expect(habitStreak(mondaysThursdays, done, "h", "2026-06-18")).toBe(0); // Thu today, not done
  });
});
