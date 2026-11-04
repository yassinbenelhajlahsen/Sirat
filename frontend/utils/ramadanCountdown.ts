import { maghribOf, slotAt, type PrayerDay } from "@/services/prayerDay";
import { isFastingDay, ramadanDayAt } from "@/utils/hijriDate";

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
  prayerDay: PrayerDay | null;
  tomorrowFajr: Date | null;
}): RamadanCardState | null {
  const { now, enabled, prayerDay, tomorrowFajr } = params;
  if (!enabled) return null;

  const maghrib = maghribOf(prayerDay);
  const day = ramadanDayAt(now, maghrib);
  if (day == null) return null;

  const fajr = slotAt(prayerDay, "Fajr");

  if (fajr && now < fajr) return { day, target: { kind: "suhoor", at: fajr } };
  if (maghrib && now < maghrib) return { day, target: { kind: "iftar", at: maghrib } };

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (tomorrowFajr && isFastingDay(tomorrow)) {
    return { day, target: { kind: "suhoor", at: tomorrowFajr } };
  }
  return { day, target: null };
}
