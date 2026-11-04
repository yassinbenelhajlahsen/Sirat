import type { PrayerTime } from "../prayer-times/types";
import type { PrayerName, PrayerStatus } from "../tracking/types";
import type { PrefMap, PrayerKey } from "./types";
import { PRAYER_EMOJI } from "./types";
import {
  FRIDAY_TITLE,
  FRIDAY_URL,
  fridayReminderFor,
} from "@/utils/notifications/fridayReminder";
import {
  WINDOW_PRAYERS,
  type WindowPrayerKey,
  type WindowPrefMap,
} from "@/utils/notifications/constants";

export type PlanDay = {
  date: Date;
  times: PrayerTime[];
  /** Marks the user has set for this day; a cleared mark is simply absent. */
  statuses: Partial<Record<PrayerName, PrayerStatus>>;
  /** A Ramadan day, so Maghrib reads as Iftar. */
  fasting: boolean;
};

export type PlanInput = {
  days: PlanDay[];
  cityDisplay: string;
  prefs: PrefMap;
  windowPrefs: WindowPrefMap;
  windowOffset: number;
  fridayEnabled: boolean;
  /** Sound for prayer alerts, already resolved for this platform. */
  prayerSound: string;
  /** Notifications at or before this moment are left out. */
  now: number;
  /** Keys already scheduled; they are not planned again. */
  seen?: ReadonlySet<string>;
  /** At most this many notifications, soonest first. */
  budget?: number;
};

export type PlannedNotification = {
  fireDate: Date;
  seenKey: string;
  title: string;
  body: string;
  sound: string;
  data: Record<string, unknown>;
};

export function yyyymmdd(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parse12hToDate(base: Date, timeStr: string): Date {
  const [hm, ampm] = timeStr.split(" ");
  const [hStr, mStr] = hm.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}

const minuteKey = (d: Date) => d.toISOString().slice(0, 16);

/** What to schedule: every alert and reminder still ahead, soonest first, within the budget. */
export function planNotifications(input: PlanInput): PlannedNotification[] {
  const { cityDisplay, prefs, windowPrefs, windowOffset, fridayEnabled, prayerSound, now } = input;
  const anyWindowEnabled = WINDOW_PRAYERS.some((key) => windowPrefs[key]);
  const planned: PlannedNotification[] = [];

  for (const { date: day, times, statuses, fasting } of input.days) {
    const dayKey = yyyymmdd(day);

    // At-prayer-time alerts.
    for (const prayer of times) {
      const label = prayer.label as PrayerKey;
      if (!prefs[label]) continue;
      const fireDate = parse12hToDate(day, prayer.time);
      if (fireDate.getTime() <= now) continue;
      planned.push({
        fireDate,
        seenKey: `${label}_${minuteKey(fireDate)}`,
        title: `${PRAYER_EMOJI[label] || "🕌"} ${fasting && label === "Maghrib" ? "Maghrib/Iftar" : label} time`,
        body: `${prayer.time} in ${cityDisplay}`,
        // Sunrise is not a prayer, so it gets no adhan.
        sound: label === "Sunrise" ? "default" : prayerSound,
        data: { type: "prayer", label, timeLocal: prayer.time, city: cityDisplay, dayKey },
      });
    }

    // Friday reminder: a varied message at a varied time late morning, opens Surah Al-Kahf.
    if (fridayEnabled && day.getDay() === 5) {
      const { fireDate, body } = fridayReminderFor(day);
      if (fireDate.getTime() > now) {
        planned.push({
          fireDate,
          seenKey: `friday_${minuteKey(fireDate)}`,
          title: FRIDAY_TITLE,
          body,
          sound: "default",
          data: { type: "friday", url: FRIDAY_URL },
        });
      }
    }

    // Window reminders: shortly before a prayer's time runs out, unless it is already logged.
    if (!anyWindowEnabled) continue;
    for (let i = 0; i < times.length; i++) {
      const label = times[i].label as PrayerKey;
      if (!WINDOW_PRAYERS.includes(label as WindowPrayerKey)) continue;
      if (!windowPrefs[label as WindowPrayerKey]) continue;
      const next = times[i + 1];
      if (!next) continue;
      if (statuses[label.toLowerCase() as PrayerName]) continue;
      const fireDate = new Date(parse12hToDate(day, next.time).getTime() - windowOffset * 60_000);
      if (fireDate.getTime() <= now) continue;
      planned.push({
        fireDate,
        seenKey: `window_${label}_${minuteKey(fireDate)}`,
        title: `${label} ending soon`,
        body: `${next.label} ${next.label === "Sunrise" ? "is" : "begins"} at ${next.time}, in ${windowOffset} min.`,
        // The adhan is a call to prayer, so it never plays for "ending soon" reminders.
        sound: "default",
        data: {
          type: "window_reminder",
          label,
          nextLabel: next.label,
          nextTimeLocal: next.time,
          offset: windowOffset,
          dayKey,
        },
      });
    }
  }

  planned.sort((a, b) => a.fireDate.getTime() - b.fireDate.getTime());
  const fresh = input.seen ? planned.filter((p) => !input.seen!.has(p.seenKey)) : planned;
  return fresh.slice(0, input.budget ?? Infinity);
}

// shortcut: a 53-bit string hash (cyrb53) rather than a crypto hash; a collision would only skip one rebuild.
function hash53(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Identifies the whole plan for the horizon as of the start of its first day, so it stays the same
 * while time passes and changes only when something that affects a notification changes.
 */
export function planFingerprint(input: PlanInput): string {
  const first = input.days[0]?.date;
  const startOfFirstDay = first
    ? new Date(first.getFullYear(), first.getMonth(), first.getDate()).getTime() - 1
    : 0;
  const plan = planNotifications({ ...input, now: startOfFirstDay, seen: undefined, budget: undefined });
  return hash53(
    JSON.stringify(plan.map((p) => [p.fireDate.getTime(), p.seenKey, p.title, p.body, p.sound, p.data])),
  );
}
