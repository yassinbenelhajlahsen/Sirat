// Umm al-Qura is the calendar the holiday feed uses (Aladhan's HJCoSA), so the date
// shown always agrees with the holidays and the Ramadan tracker.
const HIJRI = new Intl.DateTimeFormat("en-TN-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const HIJRI_PARTS = new Intl.DateTimeFormat("en-TN-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const RAMADAN_MONTH = 9;

// Dev-only preview: a Settings switch makes every day count as Ramadan. In memory, so a reload clears it.
let pretendRamadan = false;
const pretendListeners = new Set<() => void>();
export function setPretendRamadan(on: boolean): void {
  const next = __DEV__ && on;
  if (next === pretendRamadan) return;
  pretendRamadan = next;
  for (const listener of [...pretendListeners]) listener();
}
export function subscribePretendRamadan(listener: () => void): () => void {
  pretendListeners.add(listener);
  return () => pretendListeners.delete(listener);
}
export function isPretendingRamadan(): boolean {
  return pretendRamadan;
}

function hijriDayAndMonth(day: Date): { day: number; month: number } {
  const parts = HIJRI_PARTS.formatToParts(day);
  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: num("day"), month: num("month") };
}

/**
 * Whether the daylight of this Gregorian day falls in Ramadan (Umm al-Qura), i.e. a fasting day.
 * Works offline. The islamic day starts at the evening before, so the night before the first fast
 * is not a fasting day itself; use `ramadanDayAt` for "is it Ramadan right now".
 */
export function isFastingDay(date: Date): boolean {
  if (pretendRamadan) return true;
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  return hijriDayAndMonth(noon).month === RAMADAN_MONTH;
}

/**
 * The Ramadan day number (1 to 30) at the moment `at`, rolling over at Maghrib like `formatHijriDate`,
 * or null outside Ramadan. The evening before the first fast already counts as Ramadan 1.
 */
export function ramadanDayAt(at: Date, maghrib: Date | null = null): number | null {
  const day = new Date(at);
  if (maghrib && at >= maghrib) day.setDate(day.getDate() + 1);
  const h = hijriDayAndMonth(day);
  if (pretendRamadan) return h.day;
  return h.month === RAMADAN_MONTH ? h.day : null;
}

/**
 * "Jumada I 24, 1448 AH" at the moment `at`. The Islamic day starts at Maghrib, so pass
 * the same day's Maghrib to roll over at sunset; without it the date follows the Gregorian day.
 */
export function formatHijriDate(at: Date, maghrib: Date | null = null): string {
  const day = new Date(at);
  if (maghrib && at >= maghrib) day.setDate(day.getDate() + 1);
  return HIJRI.format(day);
}
