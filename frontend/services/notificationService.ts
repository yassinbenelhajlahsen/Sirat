import * as Notifications from "expo-notifications";

import { getPrayerTimesToday } from "./prayerTimes";
import {
  canUseOSLocation,
  deriveEffectiveSettings,
  resolveCityDisplay,
} from "./notifications/cityResolver";
import { HORIZON_DAYS } from "./notifications/constants";
import { initNotificationLifecycle } from "./notifications/lifecycle";
import {
  configureAndroidNotificationChannel,
  ensureNotificationPermissions,
} from "./notifications/permissions";
import {
  cancelPreviouslyScheduled,
  scheduleForHorizon,
  yyyymmdd,
} from "./notifications/scheduler";
import { isPretendingRamadan } from "@/utils/hijriDate";
import {
  readDayFingerprint,
  readMasterEnabled,
  readPrayerSettings,
  writeDayFingerprint,
} from "./notifications/storage";
import {
  notifFridaySetting,
  notifPrefsSetting,
  notifSoundModeSetting,
  notifWindowMapSetting,
  notifWindowOffsetSetting,
  ramadanModeSetting,
} from "./syncedSettings";
import type { RescheduleReason } from "./notifications/types";

export { NOTIF_PREFS_UPDATED_EVENT } from "../utils/notifications/constants";

type TodaySnapshot = {
  times: Awaited<ReturnType<typeof getPrayerTimesToday>>;
  effective: Awaited<ReturnType<typeof deriveEffectiveSettings>>;
};

let rescheduleInProgress = false;
let initDone = false;

async function fetchTodayTimesWithEffective(): Promise<TodaySnapshot> {
  const settings = await readPrayerSettings();
  const canUse = await canUseOSLocation();
  const effective = deriveEffectiveSettings(settings, canUse);
  const times = await getPrayerTimesToday(effective);
  return { times, effective };
}

// Bump when scheduled notification content changes (e.g. sounds) so devices
// cancel and rebuild pending notifications made by an older build.
const SCHEDULE_CONTENT_VERSION = 3;

function buildScheduleFingerprint(params: {
  dayKey: string;
  prefs: Awaited<ReturnType<typeof notifPrefsSetting.get>>;
  cityDisplay: string;
  soundMode: Awaited<ReturnType<typeof notifSoundModeSetting.get>>;
  times: Awaited<ReturnType<typeof getPrayerTimesToday>>;
  effective: Awaited<ReturnType<typeof deriveEffectiveSettings>>;
  windowPrefs: Awaited<ReturnType<typeof notifWindowMapSetting.get>>;
  windowOffset: Awaited<ReturnType<typeof notifWindowOffsetSetting.get>>;
  fridayEnabled: boolean;
  ramadanMode: boolean;
}): string {
  const {
    dayKey,
    prefs,
    cityDisplay,
    soundMode,
    times,
    effective,
    windowPrefs,
    windowOffset,
    fridayEnabled,
    ramadanMode,
  } = params;

  const timesFingerprint = JSON.stringify(times.map((t) => [t.label, t.time]));
  const effectiveFingerprint = JSON.stringify({
    useLocation: effective.useLocation,
    city: effective.city
      ? {
          n: effective.city.name,
          lat: effective.city.lat,
          lng: effective.city.lng,
        }
      : null,
  });

  return `v${SCHEDULE_CONTENT_VERSION}_day_${dayKey}_${JSON.stringify(prefs)}_${cityDisplay}_${timesFingerprint}_${effectiveFingerprint}_${soundMode}_${JSON.stringify(windowPrefs)}_${windowOffset}_${fridayEnabled ? 1 : 0}_${ramadanMode}${isPretendingRamadan() ? "_pretend" : ""}`;
}

export const NotificationService = {
  async init() {
    if (initDone) return;
    initDone = true;

    await configureAndroidNotificationChannel();

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true as any,
        shouldShowList: true as any,
      }),
    });

    initNotificationLifecycle((reason) => {
      NotificationService.rescheduleAll(reason).catch(() => {
        // no-op
      });
    });

    await this.rescheduleAll("init");
  },

  async rescheduleAll(reason: RescheduleReason) {
    if (rescheduleInProgress) return;
    rescheduleInProgress = true;

    try {
      const enabled = await readMasterEnabled();
      const hasPermission = await ensureNotificationPermissions();

      if (!hasPermission || !enabled) {
        await cancelPreviouslyScheduled();
        return;
      }

      const prefs = await notifPrefsSetting.get();
      const { times: todayTimes, effective } = await fetchTodayTimesWithEffective();
      const cityDisplay = await resolveCityDisplay(effective);
      const soundMode = await notifSoundModeSetting.get();
      const windowPrefs = await notifWindowMapSetting.get();
      const windowOffset = await notifWindowOffsetSetting.get();
      const fridayEnabled = await notifFridaySetting.get();
      const ramadanMode = await ramadanModeSetting.get();

      const today = yyyymmdd();
      const nextKey = buildScheduleFingerprint({
        dayKey: today,
        prefs,
        cityDisplay,
        soundMode,
        times: todayTimes,
        effective,
        windowPrefs,
        windowOffset,
        fridayEnabled,
        ramadanMode,
      });
      const lastKey = await readDayFingerprint();

      const shouldForceHeavyRebuild =
        reason === "notif-prefs-changed" ||
        reason === "settings-changed" ||
        reason === "prayer-log-changed";

      if (shouldForceHeavyRebuild || lastKey !== nextKey) {
        await cancelPreviouslyScheduled();
        await scheduleForHorizon({
          days: HORIZON_DAYS,
          prefs,
          cityDisplay,
          effective,
          soundMode,
          windowPrefs,
          windowOffset,
          fridayEnabled,
          ramadanMode,
        });
        await writeDayFingerprint(nextKey);
        return;
      }

      await scheduleForHorizon({
        days: HORIZON_DAYS,
        prefs,
        cityDisplay,
        effective,
        soundMode,
        windowPrefs,
        windowOffset,
        fridayEnabled,
        ramadanMode,
      });
    } catch (e) {
      console.warn("rescheduleAll failed:", e);
      try {
        await cancelPreviouslyScheduled();
      } catch {
        // no-op
      }
    } finally {
      rescheduleInProgress = false;
    }
  },

  async cancelAll() {
    await cancelPreviouslyScheduled();
  },
};
