import { limitLines, limitMessage } from "@/services/chat/limit";

it("formats the reset date in UTC", () => {
  expect(limitLines(15, "2026-12-01T00:00:00.000Z")).toEqual([
    "You've used this month's 15 messages.",
    "They reset on December 1.",
  ]);
});

it("falls back when allowance or reset date is missing", () => {
  expect(limitLines(null, null)).toEqual([
    "You've used this month's messages.",
    "They reset at the start of next month.",
  ]);
});

it("joins the lines with a single space", () => {
  expect(limitMessage(15, "2026-12-01T00:00:00.000Z")).toBe(
    "You've used this month's 15 messages. They reset on December 1.",
  );
});
