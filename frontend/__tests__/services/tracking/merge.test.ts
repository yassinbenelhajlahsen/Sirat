import { mergePrayerLogs, mergeHabitLogs, mergeHabits } from "@/services/tracking/merge";
import type { Habit } from "@/services/tracking/types";

describe("tracking/merge", () => {
  it("mergePrayerLogs keeps the higher updatedAt per cell", () => {
    const local = { "2026-06-19": { fajr: { value: "prayed" as const, updatedAt: 10 } } };
    const remote = {
      "2026-06-19": {
        fajr: { value: "late" as const, updatedAt: 20 },
        dhuhr: { value: "prayed" as const, updatedAt: 5 },
      },
    };
    expect(mergePrayerLogs(local, remote)).toEqual({
      "2026-06-19": {
        fajr: { value: "late", updatedAt: 20 },
        dhuhr: { value: "prayed", updatedAt: 5 },
      },
    });
  });

  it("mergeHabitLogs keeps the higher updatedAt per cell", () => {
    const local = { "2026-06-19": { h1: { value: true, updatedAt: 30 } } };
    const remote = { "2026-06-19": { h1: { value: false, updatedAt: 10 } } };
    expect(mergeHabitLogs(local, remote)).toEqual({
      "2026-06-19": { h1: { value: true, updatedAt: 30 } },
    });
  });

  it("mergeHabits keeps higher updatedAt and retains tombstones", () => {
    const base: Habit = {
      id: "h1", name: "A", icon: "i", frequency: { type: "daily" },
      order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 10,
    };
    const local = [base];
    const remote = [{ ...base, name: "A2", updatedAt: 20, deletedAt: 20 }];
    const merged = mergeHabits(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("A2");
    expect(merged[0].deletedAt).toBe(20);
  });
});
