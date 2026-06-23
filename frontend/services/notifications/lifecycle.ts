import { AppState, DeviceEventEmitter } from "react-native";

import { NOTIF_PREFS_UPDATED_EVENT } from "../../utils/notifications/constants";
import { PRAYER_LOG_UPDATED_EVENT } from "@/services/tracking/prayerLog";
import { MIDNIGHT_REFRESH_MINUTES, SETTINGS_CHANGED_EVENT } from "./constants";
import { msUntilNextLocalMidnightPlus } from "./scheduler";
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

export function initNotificationLifecycle(
  onReschedule: (reason: RescheduleReason) => void,
) {
  if (!listenersAttached) {
    listenersAttached = true;

    DeviceEventEmitter.addListener(NOTIF_PREFS_UPDATED_EVENT, () => {
      onReschedule("notif-prefs-changed");
    });

    DeviceEventEmitter.addListener(SETTINGS_CHANGED_EVENT, () => {
      onReschedule("settings-changed");
    });

    DeviceEventEmitter.addListener(PRAYER_LOG_UPDATED_EVENT, () => {
      onReschedule("prayer-log-changed");
    });

    AppState.addEventListener("change", (state) => {
      if (state === "active") {
        onReschedule("app-foreground");
      }
    });
  }

  startMidnightRescheduler(onReschedule);
}
