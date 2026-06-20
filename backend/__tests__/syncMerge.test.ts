import { describe, expect, it } from "@jest/globals";
import {
  mergeHabitLogs,
  mergeHabits,
  mergePrayerLogs,
  mergeSettings,
} from "../src/utils/syncMerge.js";
import type { Habit } from "../src/types/sync.js";

describe("syncMerge", () => {
  it("mergePrayerLogs keeps the higher updatedAt per cell", () => {
    const stored = { "2026-06-19": { fajr: { value: "prayed" as const, updatedAt: 10 } } };
    const incoming = {
      "2026-06-19": {
        fajr: { value: "late" as const, updatedAt: 20 },
        dhuhr: { value: "prayed" as const, updatedAt: 5 },
      },
    };
    expect(mergePrayerLogs(stored, incoming)).toEqual({
      "2026-06-19": {
        fajr: { value: "late", updatedAt: 20 },
        dhuhr: { value: "prayed", updatedAt: 5 },
      },
    });
  });

  it("mergePrayerLogs on equal updatedAt keeps the first arg (stored)", () => {
    const stored = { "2026-06-19": { fajr: { value: "prayed" as const, updatedAt: 10 } } };
    const incoming = { "2026-06-19": { fajr: { value: "late" as const, updatedAt: 10 } } };
    expect(mergePrayerLogs(stored, incoming)["2026-06-19"].fajr).toEqual({
      value: "prayed",
      updatedAt: 10,
    });
  });

  it("mergeHabitLogs keeps the higher updatedAt per cell", () => {
    const stored = { "2026-06-19": { h1: { value: true, updatedAt: 30 } } };
    const incoming = { "2026-06-19": { h1: { value: false, updatedAt: 10 } } };
    expect(mergeHabitLogs(stored, incoming)).toEqual({
      "2026-06-19": { h1: { value: true, updatedAt: 30 } },
    });
  });

  it("mergeHabits keeps higher updatedAt and retains tombstones", () => {
    const base: Habit = {
      id: "h1", name: "A", icon: "i", frequency: { type: "daily" },
      order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 10,
    };
    const merged = mergeHabits([base], [{ ...base, name: "A2", updatedAt: 20, deletedAt: 20 }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe("A2");
    expect(merged[0].deletedAt).toBe(20);
  });

  it("mergeHabits retains a stored-only habit", () => {
    const stored: Habit = {
      id: "h1", name: "Stored Only", icon: "leaf", frequency: { type: "daily" },
      order: 0, archived: false, createdAtKey: "2026-06-01", updatedAt: 5,
    };
    const merged = mergeHabits([stored], []);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("h1");
  });

  it("mergeSettings keeps the higher updatedAt per key and unions keys", () => {
    const stored = { theme: { value: "dark", updatedAt: 10 } };
    const incoming = {
      theme: { value: "light", updatedAt: 20 },
      prayerSettings: { value: { method: 2 }, updatedAt: 7 },
    };
    expect(mergeSettings(stored, incoming)).toEqual({
      theme: { value: "light", updatedAt: 20 },
      prayerSettings: { value: { method: 2 }, updatedAt: 7 },
    });
  });

  it("mergeSettings on equal updatedAt keeps the first arg (stored)", () => {
    const stored = { theme: { value: "dark", updatedAt: 10 } };
    const incoming = { theme: { value: "light", updatedAt: 10 } };
    expect(mergeSettings(stored, incoming).theme).toEqual({ value: "dark", updatedAt: 10 });
  });
});
