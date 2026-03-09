import AsyncStorage from "@react-native-async-storage/async-storage";
import { handleForceUpdate } from "@/services/apiClient";
import { getVersionHeaders } from "@/services/appVersion";

const HOLIDAY_API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";
const YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface Holiday {
  date: string; // "YYYY-MM-DD" (LOCAL date, not UTC ISO)
  name: string; // e.g. "Eid al-Adha"
}

type BackendErrorShape = {
  error?:
    | {
        code?: string;
        message?: string;
      }
    | string;
};

type BackendHolidayPayload = {
  holidays?: unknown;
};

type BackendProxyResponse<T> = {
  success?: boolean;
  data?: T;
} & BackendErrorShape;

// Use year:number as the key for in-memory cache
let cachedHolidays: Record<number, Holiday[]> = {};

const HOLIDAY_STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sanitizeHolidayList(input: unknown): Holiday[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const byDate = new Map<string, string>();

  input.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const typed = item as { date?: unknown; name?: unknown };
    if (
      typeof typed.date !== "string" ||
      typeof typed.name !== "string" ||
      !YYYY_MM_DD_REGEX.test(typed.date)
    ) {
      return;
    }

    const name = typed.name.trim();
    if (!name || byDate.has(typed.date)) {
      return;
    }

    byDate.set(typed.date, name);
  });

  return Array.from(byDate.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, name]) => ({ date, name }));
}

// Persist
async function saveToStorage(year: number, holidays: Holiday[]) {
  try {
    await AsyncStorage.setItem(
      `holidays-${year}`,
      JSON.stringify({ holidays, savedAt: Date.now() }),
    );
  } catch (e) {
    console.warn("Failed to save holidays:", e);
  }
}

// Load
async function loadFromStorage(year: number): Promise<Holiday[] | null> {
  try {
    const val = await AsyncStorage.getItem(`holidays-${year}`);
    if (!val) return null;
    const parsed = JSON.parse(val);
    // Backward compat: old format was a plain array — treat as expired
    if (Array.isArray(parsed)) return null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > HOLIDAY_STORAGE_TTL_MS
    ) {
      return null;
    }
    return sanitizeHolidayList(parsed.holidays);
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

function buildQueryString(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

function backendErrorMessage(status: number, body: BackendErrorShape | null): string {
  if (typeof body?.error === "string") {
    return body.error;
  }

  const fromBody = body?.error?.message;
  if (typeof fromBody === "string" && fromBody.length > 0) {
    return fromBody;
  }
  return `Holiday API error (${status})`;
}

async function fetchHolidaysFromBackend(year: number): Promise<Holiday[]> {
  const query = buildQueryString({ year });
  const url = `${HOLIDAY_API_BASE}/api/holidays/year?${query}`;
  const res = await fetch(url, { headers: getVersionHeaders() });
  const body = (await res.json().catch(() => null)) as
    | BackendProxyResponse<BackendHolidayPayload>
    | null;

  if (res.status === 426) {
    handleForceUpdate(body);
  }

  if (!res.ok) {
    throw new Error(backendErrorMessage(res.status, body));
  }

  if (!body?.success || body.data === undefined) {
    throw new Error("Invalid response from holiday API");
  }

  return sanitizeHolidayList(body.data.holidays);
}

/**
 * Fetch all Islamic holidays for a Gregorian year from backend proxy
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

  // 3) backend API fetch
  const holidays = await fetchHolidaysFromBackend(year);
  cachedHolidays[year] = holidays;
  await saveToStorage(year, holidays);

  return holidays;
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
