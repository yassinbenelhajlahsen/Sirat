import { ramadanTrackerSetting } from "@/services/syncedSettings";
import { dateKeyFromDate } from "@/utils/dateKey";
import { MISSED_FAST_BUFFER_DAYS, type RamadanPeriod } from "@/utils/hijriDate";

/**
 * Get all missed fast days from storage
 * @returns Record mapping "YYYY-MM-DD" to true (day was missed)
 */
export const getMissedFastDays = () => ramadanTrackerSetting.get();

/**
 * Check if a specific date was marked as a missed fast
 * @returns true if the day was missed, false otherwise
 */
export async function wasFastMissed(date: Date): Promise<boolean> {
  const map = await getMissedFastDays();
  return map[dateKeyFromDate(date)] === true;
}

/**
 * Mark a day as a missed fast
 * @param date - Date to mark as missed
 */
export async function markFastAsMissed(date: Date): Promise<void> {
  const map = await getMissedFastDays();
  await ramadanTrackerSetting.set({ ...map, [dateKeyFromDate(date)]: true });
}

/**
 * Remove the missed fast marking for a specific date
 * @param date - Date to clear
 */
export async function clearMissedFast(date: Date): Promise<void> {
  const { [dateKeyFromDate(date)]: _removed, ...rest } = await getMissedFastDays();
  await ramadanTrackerSetting.set(rest);
}

/**
 * Missed fasts ("YYYY-MM-DD", oldest first) inside a Ramadan period, counting the 3 days either side
 * that can be marked.
 */
export function missedFastsInPeriod(map: Record<string, boolean>, period: RamadanPeriod): string[] {
  const from = dateKeyFromDate(new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate() - MISSED_FAST_BUFFER_DAYS));
  const to = dateKeyFromDate(new Date(period.end.getFullYear(), period.end.getMonth(), period.end.getDate() + MISSED_FAST_BUFFER_DAYS));
  return Object.keys(map)
    .filter((key) => map[key] && key >= from && key <= to)
    .sort();
}

/** Missed-fast count and "Feb 19"-style labels for a Ramadan period. */
export function getRamadanPeriodSummary(
  map: Record<string, boolean>,
  period: RamadanPeriod,
): { totalMissed: number; missedDays: string[] } {
  const missed = missedFastsInPeriod(map, period);
  return {
    totalMissed: missed.length,
    missedDays: missed.map((key) => {
      const [y, m, d] = key.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }),
  };
}
