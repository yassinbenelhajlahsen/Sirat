import * as Notifications from "expo-notifications";

import { initNotificationLifecycle } from "./notifications/lifecycle";
import {
  configureAndroidNotificationChannel,
  ensureNotificationPermissions,
} from "./notifications/permissions";
import {
  applySchedule,
  cancelPreviouslyScheduled,
  readPlanInputs,
} from "./notifications/scheduler";
import { readMasterEnabled } from "./notifications/storage";
import type { RescheduleReason } from "./notifications/types";

let rescheduleInProgress = false;
let pendingReason: RescheduleReason | null = null;
let initDone = false;

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

  /** Requests that arrive while a run is in progress collapse into exactly one more run afterwards. */
  async rescheduleAll(reason: RescheduleReason) {
    if (rescheduleInProgress) {
      pendingReason = reason;
      return;
    }
    rescheduleInProgress = true;

    try {
      const enabled = await readMasterEnabled();
      const hasPermission = await ensureNotificationPermissions();

      if (!hasPermission || !enabled) {
        await cancelPreviouslyScheduled();
        return;
      }

      await applySchedule(await readPlanInputs());
    } catch (e) {
      console.warn("rescheduleAll failed:", e);
      try {
        await cancelPreviouslyScheduled();
      } catch {
        // no-op
      }
    } finally {
      rescheduleInProgress = false;
      if (pendingReason) {
        const next = pendingReason;
        pendingReason = null;
        void NotificationService.rescheduleAll(next).catch(() => {
          // no-op
        });
      }
    }
  },

  async cancelAll() {
    await cancelPreviouslyScheduled();
  },
};
