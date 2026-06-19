import type { HabitFrequency } from "@/services/habitTracker";

export const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export function frequencyLabel(freq: HabitFrequency): string {
  if (freq.type === "daily") return "Daily";
  if (freq.days.length === 0) return "Weekly";
  return [...freq.days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_SHORT[d])
    .join(", ");
}

export function isHabitDueOnDate(freq: HabitFrequency, date: Date): boolean {
  if (freq.type === "daily") return true;
  return freq.days.includes(date.getDay());
}
