import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { PrayerSettings, PrayerTime } from "../prayerTimes";
import { getPrayerTimesForDate } from "../prayerTimes";
import { getDayStatuses } from "../tracking/prayerLog";
import type { PrayerName } from "../tracking/types";
import { MAX_PENDING_NOTIFICATIONS } from "./constants";
import {
  clearScheduleStorage,
  readScheduledIds,
  readSeenKeys,
  writeScheduledIds,
  writeSeenKeys,
} from "./storage";
import {
  IOS_SOUND_MAP,
  PRAYER_EMOJI,
  type PrefMap,
  type PrayerKey,
  type SoundMode,
} from "./types";
import {
  WINDOW_PRAYERS,
  type WindowPrayerKey,
  type WindowPrefMap,
} from "@/utils/notifications/constants";

type Candidate = {
  fireDate: Date;
  seenKey: string;
  content: Notifications.NotificationContentInput;
};

function parse12hToDate(base: Date, timeStr: string): Date {
  const [hm, ampm] = timeStr.split(" ");
  const [hStr, mStr] = hm.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
}

function makeSeenKey(label: PrayerKey, fireDate: Date): string {
  const key = fireDate.toISOString().slice(0, 16);
  return `${label}_${key}`;
}

function makeWindowSeenKey(label: PrayerKey, fireDate: Date): string {
  const key = fireDate.toISOString().slice(0, 16);
  return `window_${label}_${key}`;
}

function addDays(d: Date, offset: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, 0, 0, 0, 0);
}

export function yyyymmdd(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function msUntilNextLocalMidnightPlus(minutes: number): number {
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    minutes,
    0,
    0,
  );
  return Math.max(1000, next.getTime() - now.getTime());
}

export async function cancelPreviouslyScheduled() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // no-op
  }

  const ids = await readScheduledIds();
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {
        // no-op
      }),
    ),
  );

  await clearScheduleStorage();
}

export async function scheduleForHorizon(params: {
  days: number;
  prefs: PrefMap;
  cityDisplay: string;
  effective: PrayerSettings;
  soundMode: SoundMode;
  windowPrefs: WindowPrefMap;
  windowOffset: number;
}) {
  const {
    days,
    prefs,
    cityDisplay,
    effective,
    soundMode,
    windowPrefs,
    windowOffset,
  } = params;
  const now = Date.now();

  const seen = new Set<string>(await readSeenKeys());
  const idsToPersist: string[] = [...(await readScheduledIds())];

  const iosSound = IOS_SOUND_MAP[soundMode] ?? "default";
  const triggerSound = Platform.OS === "ios" ? iosSound : "default";

  const anyWindowEnabled = WINDOW_PRAYERS.some((key) => windowPrefs[key]);

  const candidates: Candidate[] = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const day = addDays(new Date(), dayOffset);
    const dayKey = yyyymmdd(day);
    const times: PrayerTime[] = await getPrayerTimesForDate(effective, day);

    // At-prayer-time alerts.
    for (const prayer of times) {
      const label = prayer.label as PrayerKey;
      if (!prefs[label]) continue;
      const fireDate = parse12hToDate(day, prayer.time);
      if (fireDate.getTime() <= now) continue;
      candidates.push({
        fireDate,
        seenKey: makeSeenKey(label, fireDate),
        content: {
          title: `${PRAYER_EMOJI[label] || "🕌"} ${label} time`,
          body: `${prayer.time} in ${cityDisplay}`,
          sound: triggerSound,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: {
            type: "prayer",
            label,
            timeLocal: prayer.time,
            city: cityDisplay,
            dayKey,
          },
        },
      });
    }

    // Window reminders.
    if (anyWindowEnabled) {
      const dayStatuses = await getDayStatuses(dayKey);
      for (let i = 0; i < times.length; i++) {
        const label = times[i].label as PrayerKey;
        if (!WINDOW_PRAYERS.includes(label as WindowPrayerKey)) continue;
        if (!windowPrefs[label as WindowPrayerKey]) continue;
        const next = times[i + 1];
        if (!next) continue;
        if (dayStatuses[label.toLowerCase() as PrayerName]) continue;
        const fireDate = new Date(
          parse12hToDate(day, next.time).getTime() - windowOffset * 60_000,
        );
        if (fireDate.getTime() <= now) continue;
        const verb = next.label === "Sunrise" ? "is" : "begins";
        candidates.push({
          fireDate,
          seenKey: makeWindowSeenKey(label, fireDate),
          content: {
            title: `${label} ending soon`,
            body: `${next.label} ${verb} at ${next.time}, in ${windowOffset} min.`,
            sound: triggerSound,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              type: "window_reminder",
              label,
              nextLabel: next.label,
              nextTimeLocal: next.time,
              offset: windowOffset,
              dayKey,
            },
          },
        });
      }
    }
  }

  candidates.sort((a, b) => a.fireDate.getTime() - b.fireDate.getTime());

  let remaining = MAX_PENDING_NOTIFICATIONS - idsToPersist.length;

  for (const candidate of candidates) {
    if (remaining <= 0) break;
    if (seen.has(candidate.seenKey)) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: candidate.content,
      trigger: { type: "date", date: candidate.fireDate } as any,
    });
    seen.add(candidate.seenKey);
    idsToPersist.push(id);
    remaining--;
  }

  await writeScheduledIds(idsToPersist);
  await writeSeenKeys(Array.from(seen));
}
