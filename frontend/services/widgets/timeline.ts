import type { PrayerTime } from "@/services/prayerTimes";
import { parsePrayerTime } from "@/utils/prayerDial";

export const WIDGET_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export type WidgetPrayerName = (typeof WIDGET_PRAYERS)[number];

export type WidgetDay = { date: Date; times: PrayerTime[] };

export type PrayerSlot = { name: WidgetPrayerName; time: string; at: number };

// Dates cross into the widget runtime as epoch-ms numbers.
export type PrayerEntryProps = {
  // True once the stored days have run out; the widget asks the user to open the app.
  stale: boolean;
  next: PrayerSlot;
  prayers: PrayerSlot[];
  // Empty when the day has no Sunrise time (null cannot cross into the native widget).
  sunrise: string;
  gregorian: string;
  hijri: string;
};

export type PrayerTimelineEntry = { date: Date; props: PrayerEntryProps };

type ParsedDay = { date: Date; prayers: PrayerSlot[]; sunrise: string };

function parseDay({ date, times }: WidgetDay): ParsedDay | null {
  const prayers: PrayerSlot[] = [];
  for (const name of WIDGET_PRAYERS) {
    const time = times.find((t) => t.label === name)?.time;
    const at = time ? parsePrayerTime(time, date) : null;
    if (!time || !at) return null;
    prayers.push({ name, time, at: at.getTime() });
  }
  const sunrise = times.find((t) => t.label === "Sunrise")?.time ?? "";
  return { date, prayers, sunrise };
}

// Same calls Home uses, so the widget shows the dates the app shows.
function dateLabels(date: Date) {
  return {
    gregorian: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date),
    hijri: new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date),
  };
}

const EMPTY_SLOT: PrayerSlot = { name: "Fajr", time: "", at: 0 };

/**
 * One entry for `now`, then one at every later prayer time, each showing the
 * prayer that follows. The list always belongs to the day of the next prayer,
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

  const seq = parsed.flatMap((day) => day.prayers.map((slot) => ({ day, slot })));
  const nowMs = now.getTime();
  const first = seq.findIndex((s) => s.slot.at > nowMs);

  const staleEntry = (date: Date, day?: ParsedDay): PrayerTimelineEntry => ({
    date,
    props: {
      stale: true,
      next: day?.prayers[day.prayers.length - 1] ?? EMPTY_SLOT,
      prayers: day?.prayers ?? [],
      sunrise: day?.sunrise ?? "",
      ...dateLabels(day?.date ?? date),
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
        ...dateLabels(day.date),
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
