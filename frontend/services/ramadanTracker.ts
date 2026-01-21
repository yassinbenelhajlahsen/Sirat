import AsyncStorage from "@react-native-async-storage/async-storage";
import { Holiday } from "./holidayService";

// Two-state model: explicitly tracked or null (not yet marked)
export type RamadanStatus = "fasted" | "not_fasted";

// Storage key (versioned)
const RAMADAN_TRACKER_KEY = "ramadan_tracker_v1";

// Buffer days before/after Ramadan for universal compatibility
const RAMADAN_BUFFER_DAYS = 3;

/**
 * Convert Date to local date key "YYYY-MM-DD"
 * Matches holidayService.ts dateKeyFromDate pattern
 */
function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get all Ramadan statuses from storage
 * @returns Record mapping "YYYY-MM-DD" to RamadanStatus
 */
export async function getRamadanMap(): Promise<Record<string, RamadanStatus>> {
  try {
    const raw = await AsyncStorage.getItem(RAMADAN_TRACKER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Failed to load Ramadan tracker data:", e);
    return {};
  }
}

/**
 * Get Ramadan status for a specific date
 * @returns RamadanStatus if marked, null if not yet tracked
 */
export async function getRamadanStatus(
  date: Date,
): Promise<RamadanStatus | null> {
  const map = await getRamadanMap();
  return map[dateKey(date)] ?? null;
}

/**
 * Set Ramadan status for a specific date
 * @param date - Date to mark
 * @param status - "fasted" or "not_fasted"
 */
export async function setRamadanStatus(
  date: Date,
  status: RamadanStatus,
): Promise<void> {
  try {
    const map = await getRamadanMap();
    map[dateKey(date)] = status;
    await AsyncStorage.setItem(RAMADAN_TRACKER_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Failed to save Ramadan status:", e);
    throw e;
  }
}

/**
 * Check if a date is within the Ramadan visibility window
 * Applies ±3 day buffer to accommodate different madhabs and moon sightings
 *
 * @param date - Date to check
 * @param ramadanStart - First day of Ramadan (from holiday service)
 * @param ramadanEnd - Last day of Ramadan (computed as start + 29 days)
 * @returns true if date is within buffered window
 */
export function isInRamadanWindow(
  date: Date,
  ramadanStart: Date,
  ramadanEnd: Date,
): boolean {
  // Clone dates to avoid mutation
  const start = new Date(ramadanStart);
  const end = new Date(ramadanEnd);

  // Apply buffer
  start.setDate(start.getDate() - RAMADAN_BUFFER_DAYS);
  end.setDate(end.getDate() + RAMADAN_BUFFER_DAYS);

  // Reset time parts for date-only comparison
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return checkDate >= start && checkDate <= end;
}

/**
 * Extract Ramadan start date from holiday list
 * @param holidays - Array of holidays for the year
 * @returns Date object for first day of Ramadan, or null if not found
 */
export function findRamadanStart(holidays: Holiday[]): Date | null {
  const ramadanHoliday = holidays.find(
    (h) => /ramadan/i.test(h.name) && /1st|first|start|beginning/i.test(h.name),
  );
  return ramadanHoliday ? new Date(ramadanHoliday.date) : null;
}

/**
 * Compute Ramadan end date (start + 29 days)
 * Ramadan is 29-30 days; we use 29 to be conservative with buffer
 * @param ramadanStart - First day of Ramadan
 * @returns Date object for estimated last day
 */
export function computeRamadanEnd(ramadanStart: Date): Date {
  const end = new Date(ramadanStart);
  end.setDate(end.getDate() + 29);
  return end;
}

/**
 * Get Ramadan summary for the entire Ramadan period (35-38 days including buffer)
 * @param map - Full Ramadan status map
 * @param ramadanStart - First day of Ramadan
 * @param ramadanEnd - Last day of Ramadan
 * @returns Summary with missed count and formatted date strings for entire period
 */
export function getRamadanPeriodSummary(
  map: Record<string, RamadanStatus>,
  ramadanStart: Date,
  ramadanEnd: Date,
): {
  totalMissed: number;
  missedDays: string[];
} {
  const missed: string[] = [];

  // Calculate buffered window
  const windowStart = new Date(ramadanStart);
  windowStart.setDate(windowStart.getDate() - RAMADAN_BUFFER_DAYS);
  const windowEnd = new Date(ramadanEnd);
  windowEnd.setDate(windowEnd.getDate() + RAMADAN_BUFFER_DAYS);

  // Reset time parts for comparison
  windowStart.setHours(0, 0, 0, 0);
  windowEnd.setHours(0, 0, 0, 0);

  for (const [dateStr, status] of Object.entries(map)) {
    if (status !== "not_fasted") continue;

    // Parse date string parts directly to avoid timezone issues
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(0, 0, 0, 0);

    // Check if date is within the Ramadan window
    if (date >= windowStart && date <= windowEnd) {
      missed.push(dateStr);
    }
  }

  // Sort chronologically and format as "Month Day" (e.g., "Feb 19")
  return {
    totalMissed: missed.length,
    missedDays: missed.sort().map((dateStr) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }),
  };
}
