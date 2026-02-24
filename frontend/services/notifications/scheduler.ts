import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { PrayerSettings, PrayerTime } from "../prayerTimes";
import { getPrayerTimesForDate } from "../prayerTimes";
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
}) {
  const { days, prefs, cityDisplay, effective, soundMode } = params;
  const now = Date.now();

  const seen = new Set<string>(await readSeenKeys());
  const trackedIds = new Set<string>(await readScheduledIds());
  const idsToPersist: string[] = Array.from(trackedIds);

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const day = addDays(new Date(), dayOffset);
    const times: PrayerTime[] = await getPrayerTimesForDate(effective, day);

    for (const prayer of times) {
      const label = prayer.label as PrayerKey;
      if (!prefs[label]) continue;

      const fireDate = parse12hToDate(day, prayer.time);
      if (fireDate.getTime() <= now) continue;

      const seenKey = makeSeenKey(label, fireDate);
      if (seen.has(seenKey)) continue;

      const iosSound = IOS_SOUND_MAP[soundMode] ?? "default";
      const triggerSound = Platform.OS === "ios" ? iosSound : "default";

      const id = await Notifications.scheduleNotificationAsync({
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
            dayKey: yyyymmdd(day),
          },
        },
        trigger: { type: "date", date: fireDate } as any,
      });

      seen.add(seenKey);
      idsToPersist.push(id);
    }
  }

  await writeScheduledIds(idsToPersist);
  await writeSeenKeys(Array.from(seen));
}
