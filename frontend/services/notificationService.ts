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
import {
  readDayFingerprint,
  readFridayEnabled,
  readMasterEnabled,
  readPrefs,
  readPrayerSettings,
  readRamadanMode,
  readSoundMode,
  readSuhoorEnabled,
  readSuhoorOffset,
  readWindowMap,
  readWindowOffset,
  writeDayFingerprint,
} from "./notifications/storage";
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
  prefs: Awaited<ReturnType<typeof readPrefs>>;
  cityDisplay: string;
  soundMode: Awaited<ReturnType<typeof readSoundMode>>;
  times: Awaited<ReturnType<typeof getPrayerTimesToday>>;
  effective: Awaited<ReturnType<typeof deriveEffectiveSettings>>;
  windowPrefs: Awaited<ReturnType<typeof readWindowMap>>;
  windowOffset: Awaited<ReturnType<typeof readWindowOffset>>;
  fridayEnabled: boolean;
  ramadanMode: boolean;
  suhoorEnabled: boolean;
  suhoorOffset: number;
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
    suhoorEnabled,
    suhoorOffset,
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

  return `v${SCHEDULE_CONTENT_VERSION}_day_${dayKey}_${JSON.stringify(prefs)}_${cityDisplay}_${timesFingerprint}_${effectiveFingerprint}_${soundMode}_${JSON.stringify(windowPrefs)}_${windowOffset}_${fridayEnabled ? 1 : 0}_${ramadanMode}_${suhoorEnabled}_${suhoorOffset}`;
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

      const prefs = await readPrefs();
      const { times: todayTimes, effective } = await fetchTodayTimesWithEffective();
      const cityDisplay = await resolveCityDisplay(effective);
      const soundMode = await readSoundMode();
      const windowPrefs = await readWindowMap();
      const windowOffset = await readWindowOffset();
      const fridayEnabled = await readFridayEnabled();
      const ramadanMode = await readRamadanMode();
      const suhoorEnabled = await readSuhoorEnabled();
      const suhoorOffset = await readSuhoorOffset();

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
        suhoorEnabled,
        suhoorOffset,
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
          suhoorEnabled,
          suhoorOffset,
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
        suhoorEnabled,
        suhoorOffset,
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
