import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getPrayerTimesForDate } from "../prayerTimes";
import { getEffectivePrayerSettings } from "../prayerSettings";
import {
  notifFridaySetting,
  notifPrefsSetting,
  notifSoundModeSetting,
  notifWindowMapSetting,
  notifWindowOffsetSetting,
  ramadanModeSetting,
} from "../syncedSettings";
import { getDayStatuses } from "../tracking/prayerLog";
import { dateKeyFromDate } from "@/utils/dateKey";
import { isFastingDay } from "@/utils/hijriDate";
import { HORIZON_DAYS, MAX_PENDING_NOTIFICATIONS } from "./constants";
import { resolveCityDisplay } from "./cityResolver";
import { planFingerprint, planNotifications, type PlanInput } from "./planner";
import {
  clearScheduleStorage,
  readDayFingerprint,
  readScheduledIds,
  readSeenKeys,
  writeDayFingerprint,
  writeScheduledIds,
  writeSeenKeys,
} from "./storage";
import { IOS_SOUND_MAP } from "./types";


export function msUntilNextLocalMidnightPlus(minutes: number): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, minutes, 0, 0);
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

/** Gathers everything the planner needs: settings, this device's prayer times and marks for each day. */
export async function readPlanInputs(): Promise<Omit<PlanInput, "now" | "seen" | "budget">> {
  const [prefs, soundMode, windowPrefs, windowOffset, fridayEnabled, ramadanMode, effective] =
    await Promise.all([
      notifPrefsSetting.get(),
      notifSoundModeSetting.get(),
      notifWindowMapSetting.get(),
      notifWindowOffsetSetting.get(),
      notifFridaySetting.get(),
      ramadanModeSetting.get(),
      getEffectivePrayerSettings(),
    ]);

  const days: PlanInput["days"] = [];
  for (let offset = 0; offset < HORIZON_DAYS; offset++) {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    days.push({
      date,
      prayerDay: await getPrayerTimesForDate(effective, date),
      statuses: await getDayStatuses(dateKeyFromDate(date)),
      fasting: ramadanMode && isFastingDay(date),
    });
  }

  const iosSound = IOS_SOUND_MAP[soundMode] ?? "default";
  return {
    days,
    cityDisplay: await resolveCityDisplay(effective),
    prefs,
    windowPrefs,
    windowOffset,
    fridayEnabled,
    prayerSound: Platform.OS === "ios" ? iosSound : "default",
  };
}

/**
 * Brings the OS in line with the plan. If anything that affects a notification changed since last
 * time, everything pending is replaced; otherwise only notifications not yet scheduled are added.
 */
export async function applySchedule(inputs: Omit<PlanInput, "now" | "seen" | "budget">): Promise<void> {
  const nextFingerprint = planFingerprint({ ...inputs, now: 0 });
  if ((await readDayFingerprint()) !== nextFingerprint) {
    await cancelPreviouslyScheduled();
  }

  const seen = new Set<string>(await readSeenKeys());
  const ids = [...(await readScheduledIds())];
  const toSchedule = planNotifications({
    ...inputs,
    now: Date.now(),
    seen,
    budget: MAX_PENDING_NOTIFICATIONS - ids.length,
  });

  for (const notification of toSchedule) {
    const { fireDate, seenKey, ...content } = notification;
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: { ...content, priority: Notifications.AndroidNotificationPriority.HIGH },
        trigger: { type: "date", date: fireDate } as any,
      }),
    );
    seen.add(seenKey);
  }

  await writeScheduledIds(ids);
  await writeSeenKeys(Array.from(seen));
  await writeDayFingerprint(nextFingerprint);
}
