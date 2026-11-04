import {
  FRIDAY_MESSAGES,
  fridayReminderFor,
} from "@/utils/notifications/fridayReminder";

// 52 consecutive Fridays starting 2026-01-02.
const fridays = Array.from({ length: 52 }, (_, i) => new Date(2026, 0, 2 + 7 * i));

describe("utils/notifications/fridayReminder", () => {
  it("has at least 10 distinct messages, all about Al-Kahf and free of em dashes", () => {
    expect(new Set(FRIDAY_MESSAGES).size).toBeGreaterThanOrEqual(10);
    FRIDAY_MESSAGES.forEach((m) => {
      expect(m).toMatch(/Al-Kahf/);
      expect(m).not.toMatch(/—/);
    });
  });

  it("always fires on the given day between 9:00 and 10:59", () => {
    fridays.forEach((day) => {
      const { fireDate } = fridayReminderFor(day);
      expect(fireDate.getFullYear()).toBe(day.getFullYear());
      expect(fireDate.getMonth()).toBe(day.getMonth());
      expect(fireDate.getDate()).toBe(day.getDate());
      expect(fireDate.getHours()).toBeGreaterThanOrEqual(9);
      expect(fireDate.getHours()).toBeLessThanOrEqual(10);
    });
  });

  it("is deterministic for a given day", () => {
    const day = fridays[3];
    expect(fridayReminderFor(day)).toEqual(fridayReminderFor(new Date(day)));
  });

  it("varies the time and message across weeks", () => {
    const results = fridays.map(fridayReminderFor);
    expect(new Set(results.map((r) => r.body)).size).toBeGreaterThan(5);
    expect(
      new Set(results.map((r) => r.fireDate.getHours() * 60 + r.fireDate.getMinutes()))
        .size,
    ).toBeGreaterThan(20);
  });
});
