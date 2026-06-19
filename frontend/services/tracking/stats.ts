import { PRAYER_NAMES } from "./types";
import type { Habit, HabitLog, PrayerLog, PrayerName, PrayerStatus } from "./types";

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

/** Sunday-started week label "YYYY-MM-DD" derived from the week's Sunday date key. */
export function weekKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay()); // back up to Sunday
  return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(
    sunday.getDate(),
  ).padStart(2, "0")}`;
}

export function habitStreak(
  habit: Pick<Habit, "frequency">,
  doneByDay: Record<string, Record<string, boolean>>,
  habitId: string,
  todayKey: string,
): number {
  const isDone = (dateKey: string): boolean =>
    doneByDay[dateKey]?.[habitId] === true;

  if (habit.frequency.type === "daily") {
    let streak = 0;
    let cursor = isDone(todayKey) ? todayKey : addDaysKey(todayKey, -1);
    while (isDone(cursor)) {
      streak += 1;
      cursor = addDaysKey(cursor, -1);
    }
    return streak;
  }

  // weekly: walk backward over the habit's scheduled weekdays, counting
  // consecutive completed scheduled occurrences. An in-progress today
  // (scheduled but not yet done) is not counted and does not break the run.
  const days = habit.frequency.days;
  if (days.length === 0) return 0;
  const scheduled = new Set(days);
  const weekdayOf = (dateKey: string): number => {
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  };
  const prevScheduled = (dateKey: string): string => {
    let cursor = addDaysKey(dateKey, -1);
    while (!scheduled.has(weekdayOf(cursor))) cursor = addDaysKey(cursor, -1);
    return cursor;
  };

  // Find the most recent scheduled day on or before today.
  let cursor = todayKey;
  while (!scheduled.has(weekdayOf(cursor))) cursor = addDaysKey(cursor, -1);
  // If that day is today and not done yet, start from the previous occurrence.
  if (cursor === todayKey && !isDone(cursor)) cursor = prevScheduled(cursor);

  let streak = 0;
  while (isDone(cursor)) {
    streak += 1;
    cursor = prevScheduled(cursor);
  }
  return streak;
}

export function unwrapHabitLog(
  log: HabitLog,
): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const [dateKey, day] of Object.entries(log)) {
    const unwrapped: Record<string, boolean> = {};
    for (const habitId of Object.keys(day)) {
      unwrapped[habitId] = day[habitId].value;
    }
    out[dateKey] = unwrapped;
  }
  return out;
}

/** Per-day non-missed prayer fraction (0..1) for each day of the month; index 0 = day 1. */
export function monthDailyScores(
  statusesByDay: Record<string, Partial<Record<PrayerName, PrayerStatus>>>,
  year: number,
  monthIndex0: number,
): number[] {
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const scores: number[] = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const key = `${year}-${String(monthIndex0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const day = statusesByDay[key];
    if (!day) {
      scores.push(0);
      continue;
    }
    let ok = 0;
    for (const p of PRAYER_NAMES) {
      const s = day[p];
      if (s != null && s !== "missed") ok += 1;
    }
    scores.push(ok / PRAYER_NAMES.length);
  }
  return scores;
}
