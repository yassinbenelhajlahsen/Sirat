import type { PrayerName } from "@/services/prayerTracker";

const LABEL_TO_NAME: Record<string, PrayerName> = {
  Fajr: "fajr",
  Dhuhr: "dhuhr",
  Asr: "asr",
  Maghrib: "maghrib",
  Isha: "isha",
};

/** Map an arc prayer label to its PrayerName, or null if not loggable (e.g. Sunrise). */
export function prayerNameForArcLabel(label: string): PrayerName | null {
  return LABEL_TO_NAME[label] ?? null;
}
