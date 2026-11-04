import { dateKeyFromDate } from "@/utils/dateKey";
import type { PrayerName } from "./tracking/types";

/** A prayer, or Sunrise (which ends Fajr's window but is not a prayer). */
export type SlotName = PrayerName | "Sunrise";

export type PrayerSlot = { name: SlotName; at: Date };

/** One day's prayer times as real moments, in order. Strings exist only at display. */
export type PrayerDay = {
  /** Local "YYYY-MM-DD". */
  dateKey: string;
  slots: PrayerSlot[];
};

const SLOT_ORDER: readonly SlotName[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

/** "h:mm AM/PM" onto `base`, or null when unreadable. The only 12-hour parser. */
function parse12h(time: string, base: Date): Date | null {
  const [hm, modifier] = time.split(" ");
  const [hStr, mStr] = (hm ?? "").split(":");
  let hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0);
}

/** Builds a day from the stored `{ label, time }` rows. Rows that are unknown or unreadable are dropped. */
export function buildPrayerDay(date: Date, rows: { label: string; time: string }[]): PrayerDay {
  const slots: PrayerSlot[] = [];
  for (const name of SLOT_ORDER) {
    const row = rows.find((r) => r.label === name);
    const at = row ? parse12h(row.time, date) : null;
    if (at) slots.push({ name, at });
  }
  return { dateKey: dateKeyFromDate(date), slots };
}

export function emptyPrayerDay(date: Date): PrayerDay {
  return { dateKey: dateKeyFromDate(date), slots: [] };
}

export function slotAt(day: PrayerDay | null | undefined, name: SlotName): Date | null {
  return day?.slots.find((s) => s.name === name)?.at ?? null;
}

/** That day's Maghrib, when the Islamic day turns. */
export const maghribOf = (day: PrayerDay | null | undefined) => slotAt(day, "Maghrib");

/** The first slot after `now`, or null once the day is over. */
export function nextSlot(day: PrayerDay | null | undefined, now: Date): PrayerSlot | null {
  return day?.slots.find((s) => s.at > now) ?? null;
}

/** The slot that ends `name`'s window: the one after it (Sunrise for Fajr). Null for Isha. */
export function windowEnd(day: PrayerDay, name: SlotName): PrayerSlot | null {
  const i = day.slots.findIndex((s) => s.name === name);
  return i === -1 ? null : (day.slots[i + 1] ?? null);
}

/** "5:42 PM". */
export function formatClock(at: Date): string {
  const h = at.getHours();
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(at.getMinutes()).padStart(2, "0")} ${period}`;
}
