import { formatMonthDay, formatWeekdayMonthDay } from "@/utils/formatDate";

describe("formatMonthDay", () => {
  it.each([
    [new Date(2026, 10, 1), "Nov 1st"],
    [new Date(2026, 10, 2), "Nov 2nd"],
    [new Date(2026, 10, 3), "Nov 3rd"],
    [new Date(2026, 10, 4), "Nov 4th"],
    [new Date(2026, 10, 10), "Nov 10th"],
    [new Date(2026, 10, 11), "Nov 11th"],
    [new Date(2026, 10, 12), "Nov 12th"],
    [new Date(2026, 10, 13), "Nov 13th"],
    [new Date(2026, 10, 21), "Nov 21st"],
    [new Date(2026, 10, 22), "Nov 22nd"],
    [new Date(2026, 10, 23), "Nov 23rd"],
    [new Date(2026, 9, 31), "Oct 31st"],
  ])("%s -> %s", (date, expected) => {
    expect(formatMonthDay(date)).toBe(expected);
  });
});

describe("formatWeekdayMonthDay", () => {
  it("prefixes the short weekday", () => {
    expect(formatWeekdayMonthDay(new Date(2026, 10, 1))).toBe("Sun, Nov 1st");
  });
});
