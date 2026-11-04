import type { PrayerTime } from "@/services/prayerTimes";
import { isFastingDay, maghribOn, ramadanDayAt } from "@/utils/hijriDate";
import { parsePrayerTime } from "@/utils/prayerDial";

export type RamadanTarget = { kind: "suhoor" | "iftar"; at: Date };

export type RamadanCardState = {
  day: number;
  /** Null when the next target is unknown (after Maghrib with no next-day Fajr loaded). */
  target: RamadanTarget | null;
};

/**
 * What the Home Ramadan card shows at `now`, or null when it should be hidden.
 * Before Fajr: suhoor ends. Between Fajr and Maghrib: iftar. After Maghrib: the next day's
 * suhoor, only if that day is itself a fasting day.
 */
export function getRamadanCardState(params: {
  now: Date;
  enabled: boolean;
  prayerTimes: PrayerTime[];
  tomorrowFajr: string | null;
}): RamadanCardState | null {
  const { now, enabled, prayerTimes, tomorrowFajr } = params;
  if (!enabled) return null;

  const maghrib = maghribOn(now, prayerTimes);
  const day = ramadanDayAt(now, maghrib);
  if (day == null) return null;

  const fajrStr = prayerTimes.find((t) => t.label === "Fajr")?.time;
  const fajr = fajrStr ? parsePrayerTime(fajrStr, now) : null;

  if (fajr && now < fajr) return { day, target: { kind: "suhoor", at: fajr } };
  if (maghrib && now < maghrib) return { day, target: { kind: "iftar", at: maghrib } };

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextFajr = tomorrowFajr ? parsePrayerTime(tomorrowFajr, tomorrow) : null;
  if (nextFajr && isFastingDay(tomorrow)) {
    return { day, target: { kind: "suhoor", at: nextFajr } };
  }
  return { day, target: null };
}
