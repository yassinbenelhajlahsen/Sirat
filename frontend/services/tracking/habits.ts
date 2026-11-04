import { dateKeyFromDate } from "../holidayService";
import type { Habit, HabitFrequency, HabitReminder } from "./types";
import { createTrackerStore } from "./trackerStore";
import { newId, nowMs } from "./util";

export const HABITS_STORAGE_KEY = "tracking:habits_v1";
export const HABITS_UPDATED_EVENT = "HABITS_UPDATED";

function migrateHabitFrequency(h: Habit): Habit {
  const f = h.frequency as { type?: string; days?: unknown };
  if (f?.type === "weekly" && !Array.isArray(f.days)) {
    return { ...h, frequency: { type: "daily" } };
  }
  return h;
}

export const habitsStore = createTrackerStore<Habit[]>({
  storageKey: HABITS_STORAGE_KEY,
  event: HABITS_UPDATED_EVENT,
  empty: () => [],
  parse: (raw) => (Array.isArray(raw) ? (raw as Habit[]).map(migrateHabitFrequency) : []),
});

export const getAllHabits = () => habitsStore.get();

export const activeHabits = (all: Habit[]): Habit[] =>
  all.filter((h) => !h.archived && h.deletedAt == null).sort((a, b) => a.order - b.order);

export async function getActiveHabits(): Promise<Habit[]> {
  return activeHabits(await getAllHabits());
}

const persist = (habits: Habit[]) => habitsStore.save(habits);

export async function createHabit(input: {
  name: string;
  icon: string;
  frequency: HabitFrequency;
  reminder?: HabitReminder;
}): Promise<Habit> {
  const all = await getAllHabits();
  const maxOrder = all.reduce((m, h) => Math.max(m, h.order), -1);
  const ts = nowMs();
  const habit: Habit = {
    id: newId(),
    name: input.name,
    icon: input.icon,
    frequency: input.frequency,
    reminder: input.reminder,
    order: maxOrder + 1,
    archived: false,
    createdAtKey: dateKeyFromDate(new Date(nowMs())),
    updatedAt: ts,
  };
  await persist([...all, habit]);
  return habit;
}

export async function updateHabit(
  id: string,
  patch: Partial<
    Pick<Habit, "name" | "icon" | "frequency" | "reminder" | "archived" | "order">
  >,
): Promise<void> {
  const all = await getAllHabits();
  const next = all.map((h) =>
    h.id === id ? { ...h, ...patch, updatedAt: nowMs() } : h,
  );
  await persist(next);
}

export async function reorderHabits(orderedIds: string[]): Promise<void> {
  const all = await getAllHabits();
  const ts = nowMs();
  const next = all.map((h) => {
    const idx = orderedIds.indexOf(h.id);
    return idx === -1 ? h : { ...h, order: idx, updatedAt: ts };
  });
  await persist(next);
}

export async function deleteHabit(id: string): Promise<void> {
  const all = await getAllHabits();
  const ts = nowMs();
  const next = all.map((h) =>
    h.id === id ? { ...h, deletedAt: ts, updatedAt: ts } : h,
  );
  await persist(next);
}

export async function replaceAllHabits(habits: Habit[]): Promise<void> {
  await persist(habits);
}
