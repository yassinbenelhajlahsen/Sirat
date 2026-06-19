import { PRAYER_NAMES } from "./types";
import type { PrayerLog, PrayerName, PrayerStatus } from "./types";

type DayStatuses = Partial<Record<PrayerName, PrayerStatus>>;
type StatusesByDay = Record<string, DayStatuses>;

/** Shift a "YYYY-MM-DD" local key by whole days. */
export function addDaysKey(dateKey: string, delta: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function isDayComplete(day: DayStatuses | undefined): boolean {
  if (!day) return false;
  return PRAYER_NAMES.every((p) => day[p] != null && day[p] !== "missed");
}

export function prayerStreak(
  statusesByDay: StatusesByDay,
  todayKey: string,
): number {
  let streak = 0;
  // If today is incomplete, start counting from yesterday (don't break the run).
  let cursor = isDayComplete(statusesByDay[todayKey])
    ? todayKey
    : addDaysKey(todayKey, -1);
  while (isDayComplete(statusesByDay[cursor])) {
    streak += 1;
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

export function monthlyCompletion(
  statusesByDay: StatusesByDay,
  year: number,
  monthIndex0: number,
): { overall: number; byPrayer: Record<PrayerName, number> } {
  const prefix = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-`;
  const loggedTotals = { count: 0, ok: 0 };
  const byPrayerCount = {} as Record<PrayerName, number>;
  const byPrayerOk = {} as Record<PrayerName, number>;
  for (const p of PRAYER_NAMES) {
    byPrayerCount[p] = 0;
    byPrayerOk[p] = 0;
  }
  for (const [dateKey, day] of Object.entries(statusesByDay)) {
    if (!dateKey.startsWith(prefix)) continue;
    for (const p of PRAYER_NAMES) {
      const status = day[p];
      if (status == null) continue;
      loggedTotals.count += 1;
      byPrayerCount[p] += 1;
      if (status !== "missed") {
        loggedTotals.ok += 1;
        byPrayerOk[p] += 1;
      }
    }
  }
  const byPrayer = {} as Record<PrayerName, number>;
  for (const p of PRAYER_NAMES) {
    byPrayer[p] = byPrayerCount[p] === 0 ? 0 : byPrayerOk[p] / byPrayerCount[p];
  }
  return {
    overall: loggedTotals.count === 0 ? 0 : loggedTotals.ok / loggedTotals.count,
    byPrayer,
  };
}

export function qadaCount(statusesByDay: StatusesByDay): number {
  let n = 0;
  for (const day of Object.values(statusesByDay)) {
    for (const p of PRAYER_NAMES) {
      if (day[p] === "missed") n += 1;
    }
  }
  return n;
}

export function unwrapPrayerLog(log: PrayerLog): StatusesByDay {
  const out: StatusesByDay = {};
  for (const [dateKey, day] of Object.entries(log)) {
    const unwrapped: DayStatuses = {};
    for (const p of Object.keys(day) as PrayerName[]) {
      const cell = day[p];
      if (cell) unwrapped[p] = cell.value;
    }
    out[dateKey] = unwrapped;
  }
  return out;
}
