import type { PrayerTime } from "@/services/prayerTimes";
import { parsePrayerTime } from "@/utils/prayerDial";

// Umm al-Qura is the calendar the holiday feed uses (Aladhan's HJCoSA), so the date
// shown always agrees with the holidays and the Ramadan tracker.
const HIJRI = new Intl.DateTimeFormat("en-TN-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** That day's Maghrib, or null when the times don't include it. */
export function maghribOn(date: Date, times: PrayerTime[]): Date | null {
  const time = times.find((t) => t.label === "Maghrib")?.time;
  return time ? parsePrayerTime(time, date) : null;
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
