import type { HabitLog } from "./types";
import { createTrackerStore, isRecord } from "./trackerStore";
import { nowMs } from "./util";

export const HABIT_LOG_STORAGE_KEY = "tracking:habit_log_v1";
export const HABIT_LOG_UPDATED_EVENT = "HABIT_LOG_UPDATED";

export const habitLogStore = createTrackerStore<HabitLog>({
  storageKey: HABIT_LOG_STORAGE_KEY,
  event: HABIT_LOG_UPDATED_EVENT,
  empty: () => ({}),
  parse: (raw) => (isRecord(raw) ? (raw as HabitLog) : {}),
});

export const getHabitLog = () => habitLogStore.get();
export const getCachedHabitLog = () => habitLogStore.peek();

export async function preloadHabitLog(): Promise<void> {
  await habitLogStore.get();
}

export async function getDayHabitDone(dateKey: string): Promise<Record<string, boolean>> {
  const day = (await habitLogStore.get())[dateKey] ?? {};
  return Object.fromEntries(Object.entries(day).map(([habitId, cell]) => [habitId, cell.value]));
}

export async function setHabitDone(dateKey: string, habitId: string, done: boolean): Promise<void> {
  const log = await habitLogStore.get();
  await habitLogStore.save(
    { ...log, [dateKey]: { ...log[dateKey], [habitId]: { value: done, updatedAt: nowMs() } } },
    { dateKey },
  );
}

export const replaceHabitLog = (log: HabitLog) => habitLogStore.save(log, { dateKey: null });
