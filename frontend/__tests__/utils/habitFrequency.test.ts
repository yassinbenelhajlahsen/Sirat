import { frequencyLabel, isHabitDueOnDate, WEEKDAY_SHORT } from "@/utils/habitFrequency";

describe("frequencyLabel", () => {
  it("formats daily, weekday list, and empty weekly", () => {
    expect(frequencyLabel({ type: "daily" })).toBe("Daily");
    expect(frequencyLabel({ type: "weekly", days: [1, 4] })).toBe("Mon, Thu");
    expect(frequencyLabel({ type: "weekly", days: [] })).toBe("Weekly");
  });
  it("lists days in week order regardless of input order", () => {
    expect(frequencyLabel({ type: "weekly", days: [4, 1, 0] })).toBe("Sun, Mon, Thu");
  });
});

describe("isHabitDueOnDate", () => {
  it("daily is always due", () => {
    expect(isHabitDueOnDate({ type: "daily" }, new Date(2026, 5, 16))).toBe(true);
  });
  it("weekly is due only on its weekdays", () => {
    const tue = new Date(2026, 5, 16); // 2026-06-16 is a Tuesday (getDay()===2)
    const thu = new Date(2026, 5, 18); // Thursday (getDay()===4)
    expect(isHabitDueOnDate({ type: "weekly", days: [4] }, tue)).toBe(false);
    expect(isHabitDueOnDate({ type: "weekly", days: [4] }, thu)).toBe(true);
  });
  it("WEEKDAY_SHORT is Sun..Sat", () => {
    expect(WEEKDAY_SHORT[0]).toBe("Sun");
    expect(WEEKDAY_SHORT[6]).toBe("Sat");
  });
});
