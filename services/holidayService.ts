import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Holiday {
  date: string; // "YYYY-MM-DD" (LOCAL date, not UTC ISO)
  name: string; // e.g. "Eid al-Adha"
}

// Use year:number as the key for in-memory cache
let cachedHolidays: Record<number, Holiday[]> = {};

// Persist
async function saveToStorage(year: number, holidays: Holiday[]) {
  try {
    await AsyncStorage.setItem(`holidays-${year}`, JSON.stringify(holidays));
  } catch (e) {
    console.warn("Failed to save holidays:", e);
  }
}

// Load
async function loadFromStorage(year: number): Promise<Holiday[] | null> {
  try {
    const val = await AsyncStorage.getItem(`holidays-${year}`);
    if (!val) return null;
    return JSON.parse(val);
  } catch (e) {
    console.warn("Failed to load holidays:", e);
    return null;
  }
}

// Local date key from parts
function formatDateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Local date key from Date
export function dateKeyFromDate(d: Date): string {
  return formatDateKeyFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Fetch all Islamic holidays for a Gregorian year using Aladhan gToHCalendar
 * Returns local day keys "YYYY-MM-DD"
 */
export async function getHolidaysForYear(year: number): Promise<Holiday[]> {
  // 1) in-memory
  if (cachedHolidays[year]) return cachedHolidays[year];

  // 2) storage
  const stored = await loadFromStorage(year);
  if (stored) {
    cachedHolidays[year] = stored;
    return stored;
  }

  // 3) fetch month by month
  const collected: Holiday[] = [];

  for (let month = 1; month <= 12; month++) {
    try {
      const res = await fetch(`https://api.aladhan.com/v1/gToHCalendar/${month}/${year}`);
      const data = await res.json();

      if (!data?.data) continue;

      data.data.forEach((day: any) => {
        const g = day.gregorian;
        const h = day.hijri;

        if (h?.holidays && Array.isArray(h.holidays) && h.holidays.length > 0) {
          const isoLocal = formatDateKeyFromParts(
            parseInt(g.year, 10),
            Number(g.month.number),
            parseInt(g.day, 10)
          );

          h.holidays.forEach((name: string) => {
            collected.push({ date: isoLocal, name });
          });
        }
      });
    } catch (e) {
      console.warn(`Failed to fetch holidays for ${year}-${month}:`, e);
    }
  }

  // Deduplicate by date; keep the first name or join if you prefer
  const byDate = new Map<string, string[]>();
  for (const h of collected) {
    const arr = byDate.get(h.date) ?? [];
    arr.push(h.name);
    byDate.set(h.date, arr);
  }

  const deduped: Holiday[] = [];
  byDate.forEach((names, date) => {
    deduped.push({ date, name: names[0] }); // or names.join(", ")
  });

  cachedHolidays[year] = deduped;
  await saveToStorage(year, deduped);

  return deduped;
}

/**
 * Build a fast O(1) map for the visible year
 * key: "YYYY-MM-DD" -> holiday name
 */
export async function getHolidayMapForYear(year: number): Promise<Record<string, string>> {
  const list = await getHolidaysForYear(year);
  const map: Record<string, string> = {};
  for (const h of list) {
    if (!map[h.date]) map[h.date] = h.name;
  }
  return map;
}

/** Optional helper during debugging */
export async function clearHolidayCache(year?: number) {
  if (typeof year === "number") {
    delete cachedHolidays[year];
    await AsyncStorage.removeItem(`holidays-${year}`);
  } else {
    cachedHolidays = {};
    // If you want to nuke storage for multiple years, do it explicitly elsewhere
  }
}
