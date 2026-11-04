import { formatClock, slotAt, type PrayerDay } from "@/services/prayerDay";
import { formatHijriDate } from "@/utils/hijriDate";

export const WIDGET_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export type WidgetPrayerName = (typeof WIDGET_PRAYERS)[number];

export type WidgetDay = { date: Date; prayerDay: PrayerDay };

export type PrayerSlot = { name: WidgetPrayerName; time: string; at: number };

// What the widget counts down to: a prayer, or Sunrise (the end of Fajr's window).
export type NextSlot = { name: WidgetPrayerName | "Sunrise"; time: string; at: number };

// Dates cross into the widget runtime as epoch-ms numbers.
export type PrayerEntryProps = {
  // True once the stored days have run out; the widget asks the user to open the app.
  stale: boolean;
  next: NextSlot;
  prayers: PrayerSlot[];
  // Empty when the day has no Sunrise time (null cannot cross into the native widget).
  sunrise: string;
  gregorian: string;
  hijri: string;
};

export type PrayerTimelineEntry = { date: Date; props: PrayerEntryProps };

type ParsedDay = { date: Date; prayers: PrayerSlot[]; sunrise: string; sunriseAt: number | null };

function parseDay({ date, prayerDay }: WidgetDay): ParsedDay | null {
  const prayers: PrayerSlot[] = [];
  for (const name of WIDGET_PRAYERS) {
    const at = slotAt(prayerDay, name);
    if (!at) return null;
    prayers.push({ name, time: formatClock(at), at: at.getTime() });
  }
  const sunriseDate = slotAt(prayerDay, "Sunrise");
  return {
    date,
    prayers,
    sunrise: sunriseDate ? formatClock(sunriseDate) : "",
    sunriseAt: sunriseDate ? sunriseDate.getTime() : null,
  };
}

// Same calls Home uses, so the widget shows the dates the app shows. The Gregorian date
// is the listed day's; the Hijri date follows the moment `at`, turning at that evening's
// Maghrib (after Isha the list is tomorrow's, but the moment is still tonight).
function dateLabels(day: Date, at: Date, parsed: ParsedDay[]) {
  const sameDay = parsed.find((p) => p.date.toDateString() === at.toDateString());
  const maghrib = sameDay?.prayers.find((p) => p.name === "Maghrib")?.at;
  return {
    gregorian: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(day),
    // The era suffix (" AH") is dropped: it is what the lock screen truncates.
    hijri: formatHijriDate(at, maghrib ? new Date(maghrib) : null).replace(/\s*AH$/, ""),
  };
}

const EMPTY_SLOT: NextSlot = { name: "Fajr", time: "", at: 0 };

/**
 * One entry for `now`, then one at every later prayer time (and Sunrise), each
 * showing the event that follows. The list always belongs to the day of the next prayer,
 * so after Isha it flips to tomorrow. The final entry is stale: it lands on the
 * last stored Isha, after which nothing newer is known.
 */
export function buildPrayerTimeline(days: WidgetDay[], now: Date): PrayerTimelineEntry[] {
  const parsed: ParsedDay[] = [];
  for (const d of days) {
    const p = parseDay(d);
    if (!p) break;
    parsed.push(p);
  }

  // Sunrise sits between Fajr and Dhuhr in the countdown sequence only; the list rows stay at five.
  const seq = parsed.flatMap((day) => {
    const slots: NextSlot[] = [...day.prayers];
    if (day.sunriseAt !== null) {
      slots.splice(1, 0, { name: "Sunrise", time: day.sunrise, at: day.sunriseAt });
    }
    return slots.map((slot) => ({ day, slot }));
  });
  const nowMs = now.getTime();
  const first = seq.findIndex((s) => s.slot.at > nowMs);

  const staleEntry = (date: Date, day?: ParsedDay): PrayerTimelineEntry => ({
    date,
    props: {
      stale: true,
      next: day?.prayers[day.prayers.length - 1] ?? EMPTY_SLOT,
      prayers: day?.prayers ?? [],
      sunrise: day?.sunrise ?? "",
      ...dateLabels(day?.date ?? date, date, parsed),
    },
  });

  if (first === -1) return [staleEntry(now, parsed[parsed.length - 1])];

  const showing = (date: Date, i: number): PrayerTimelineEntry => {
    const { day, slot } = seq[i];
    return {
      date,
      props: {
        stale: false,
        next: slot,
        prayers: day.prayers,
        sunrise: day.sunrise,
        ...dateLabels(day.date, date, parsed),
      },
    };
  };

  const entries = [showing(now, first)];
  for (let i = first; i < seq.length; i++) {
    const at = new Date(seq[i].slot.at);
    entries.push(i + 1 < seq.length ? showing(at, i + 1) : staleEntry(at, seq[i].day));
  }
  return entries;
}
