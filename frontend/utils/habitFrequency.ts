import type { HabitFrequency } from "@/services/habitTracker";

export function frequencyLabel(freq: HabitFrequency): string {
  return freq.type === "daily" ? "Daily" : `${freq.timesPerWeek}× / week`;
}
