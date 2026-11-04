import { AppState } from "react-native";

import { prayerLogStore } from "@/services/tracking/prayerLog";
import {
  notifFridaySetting,
  notifPrefsSetting,
  notifSoundModeSetting,
  notifWindowMapSetting,
  notifWindowOffsetSetting,
  prayerSettingsSetting,
  ramadanModeSetting,
} from "@/services/syncedSettings";
import { subscribePretendRamadan } from "@/utils/hijriDate";
import { MIDNIGHT_REFRESH_MINUTES } from "./constants";
import { msUntilNextLocalMidnightPlus } from "./scheduler";
import { subscribeMasterEnabled } from "./storage";
import type { RescheduleReason } from "./types";

let midnightTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

function startMidnightRescheduler(onReschedule: (reason: RescheduleReason) => void) {
  if (midnightTimer) {
    clearTimeout(midnightTimer);
  }

  midnightTimer = setTimeout(() => {
    onReschedule("midnight");
    startMidnightRescheduler(onReschedule);
  }, msUntilNextLocalMidnightPlus(MIDNIGHT_REFRESH_MINUTES));
}

/** Asks for a reschedule whenever something a notification depends on changes. */
export function initNotificationLifecycle(
  onReschedule: (reason: RescheduleReason) => void,
) {
  if (!listenersAttached) {
    listenersAttached = true;

    prayerSettingsSetting.subscribe(() => onReschedule("settings-changed"));
    for (const setting of [
      notifPrefsSetting,
      notifSoundModeSetting,
      notifWindowMapSetting,
      notifWindowOffsetSetting,
      notifFridaySetting,
      ramadanModeSetting,
    ]) {
      setting.subscribe(() => onReschedule("notif-prefs-changed"));
    }
    subscribeMasterEnabled(() => onReschedule("notif-prefs-changed"));
    subscribePretendRamadan(() => onReschedule("notif-prefs-changed"));
    prayerLogStore.subscribe(() => onReschedule("prayer-log-changed"));

    AppState.addEventListener("change", (state) => {
      if (state === "active") {
        onReschedule("app-foreground");
      }
    });
  }

  startMidnightRescheduler(onReschedule);
}
