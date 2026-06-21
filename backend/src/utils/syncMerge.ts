import type {
  Cell,
  Habit,
  HabitLog,
  PrayerLog,
  SettingsEnvelope,
} from "../types/sync.js";

// Last-write-wins by updatedAt. On an exact tie, the FIRST argument (`a`) is
// kept. Server calls these as merge(stored, incoming), so stored wins ties —
// an equal-stamped incoming never overwrites it. Ported from
// frontend/services/tracking/merge.ts; keep in sync via the shared test vector.
function pickCell<T>(a: Cell<T> | undefined, b: Cell<T> | undefined): Cell<T> | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

export function mergePrayerLogs(local: PrayerLog, remote: PrayerLog): PrayerLog {
  const out: PrayerLog = {};
  const dateKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const dateKey of dateKeys) {
    const l = local[dateKey] ?? {};
    const r = remote[dateKey] ?? {};
    const prayers = new Set([...Object.keys(l), ...Object.keys(r)]) as Set<keyof typeof l>;
    const day: (typeof out)[string] = {};
    for (const p of prayers) {
      const cell = pickCell(l[p], r[p]);
      if (cell) day[p] = cell;
    }
    out[dateKey] = day;
  }
  return out;
}

export function mergeHabitLogs(local: HabitLog, remote: HabitLog): HabitLog {
  const out: HabitLog = {};
  const dateKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const dateKey of dateKeys) {
    const l = local[dateKey] ?? {};
    const r = remote[dateKey] ?? {};
    const ids = new Set([...Object.keys(l), ...Object.keys(r)]);
    const day: Record<string, Cell<boolean>> = {};
    for (const id of ids) {
      const cell = pickCell(l[id], r[id]);
      if (cell) day[id] = cell;
    }
    out[dateKey] = day;
  }
  return out;
}

export function mergeHabits(local: Habit[], remote: Habit[]): Habit[] {
  const byId = new Map<string, Habit>();
  for (const h of local) byId.set(h.id, h);
  for (const h of remote) {
    const existing = byId.get(h.id);
    if (!existing || h.updatedAt > existing.updatedAt) byId.set(h.id, h);
  }
  return [...byId.values()];
}

export function mergeSettings(local: SettingsEnvelope, remote: SettingsEnvelope): SettingsEnvelope {
  const out: SettingsEnvelope = {};
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const k of keys) {
    const cell = pickCell(local[k], remote[k]);
    if (cell) out[k] = cell;
  }
  return out;
}
