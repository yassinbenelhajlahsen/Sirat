import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  mergeHabitLogs,
  mergeHabits,
  mergePrayerLogs,
  mergeSettings,
} from "../src/utils/syncMerge.js";

// Same vectors as frontend/__tests__/services/tracking/merge.test.ts, so the two merges cannot drift apart.
// Tests run from backend/, so the shared file is one level up.
const vectors = JSON.parse(readFileSync(resolve(process.cwd(), "../shared/syncMergeVectors.json"), "utf8"));

type Vector = { name: string; first: unknown; second: unknown; expected: unknown };

describe.each([
  ["prayerLog", mergePrayerLogs],
  ["habitLog", mergeHabitLogs],
  ["habits", mergeHabits],
  ["settings", mergeSettings],
] as const)("syncMerge %s", (domain, merge) => {
  it.each(vectors[domain] as Vector[])("$name", ({ first, second, expected }) => {
    expect((merge as (a: unknown, b: unknown) => unknown)(first, second)).toEqual(expected);
  });
});
