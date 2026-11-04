import { useCallback } from "react";

import { useTrackerData } from "@/hooks/useTrackerData";
import { habitLogStore, setHabitDone, unwrapHabitLog } from "@/services/habitTracker";

const NONE: Record<string, boolean> = {};
const NONE_BY_DAY: Record<string, Record<string, boolean>> = {};

export function useHabitLog(dateKey: string) {
  const done = useTrackerData(
    habitLogStore,
    (log) => unwrapHabitLog({ [dateKey]: log[dateKey] ?? {} })[dateKey],
    NONE,
    dateKey,
  );

  const toggle = useCallback(
    (habitId: string) => setHabitDone(dateKey, habitId, !done[habitId]),
    [dateKey, done],
  );

  return { done, toggle };
}

export function useHabitLogAll() {
  return useTrackerData(habitLogStore, unwrapHabitLog, NONE_BY_DAY);
}
