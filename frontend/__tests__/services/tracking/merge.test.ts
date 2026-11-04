import { readFileSync } from "fs";
import { resolve } from "path";

import { mergeHabitLogs, mergeHabits, mergePrayerLogs, mergeSettings } from "@/services/tracking/merge";

// Same vectors as backend/__tests__/syncMerge.test.ts, so the two merges cannot drift apart.
const vectors = JSON.parse(readFileSync(resolve(process.cwd(), "../shared/syncMergeVectors.json"), "utf8"));

type Vector = { name: string; first: never; second: never; expected: unknown };

describe.each([
  ["prayerLog", mergePrayerLogs],
  ["habitLog", mergeHabitLogs],
  ["habits", mergeHabits],
  ["settings", mergeSettings],
] as const)("merge %s", (domain, merge) => {
  it.each(vectors[domain] as Vector[])("$name", ({ first, second, expected }) => {
    expect((merge as (a: unknown, b: unknown) => unknown)(first, second)).toEqual(expected);
  });
});
