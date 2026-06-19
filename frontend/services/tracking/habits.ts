import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import type { Habit, HabitFrequency, HabitReminder } from "./types";
import { newId, nowMs } from "./util";

export const HABITS_STORAGE_KEY = "tracking:habits_v1";
export const HABITS_UPDATED_EVENT = "HABITS_UPDATED";

let cache: Habit[] | null = null;
let loadPromise: Promise<Habit[]> | null = null;

function emit(): void {
  try {
    DeviceEventEmitter.emit(HABITS_UPDATED_EVENT);
  } catch {
    // best-effort
  }
}

export async function getAllHabits(): Promise<Habit[]> {
  if (cache) return cache;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(HABITS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        cache = Array.isArray(parsed) ? (parsed as Habit[]) : [];
      } catch {
        cache = [];
      } finally {
        loadPromise = null;
      }
      return cache as Habit[];
    })();
  }
  return loadPromise;
}

export async function getActiveHabits(): Promise<Habit[]> {
  const all = await getAllHabits();
  return all
    .filter((h) => !h.archived && h.deletedAt == null)
    .sort((a, b) => a.order - b.order);
}

async function persist(habits: Habit[]): Promise<void> {
  cache = habits;
  try {
    await AsyncStorage.setItem(HABITS_STORAGE_KEY, JSON.stringify(habits));
  } catch {
    // keep in-memory state even if persistence fails
  }
  emit();
}

function dateKeyNow(): string {
  const d = new Date(nowMs());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

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
    createdAtKey: dateKeyNow(),
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
