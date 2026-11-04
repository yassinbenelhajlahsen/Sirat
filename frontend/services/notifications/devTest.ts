import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { DEFAULT_PREFS, IOS_SOUND_MAP } from "./types";
import { planNotifications, type PlannedNotification } from "./planner";
import { readPlanInputs } from "./scheduler";
import { ensureNotificationPermissions } from "./permissions";
import { WINDOW_PRAYERS, type WindowPrefMap } from "@/utils/notifications/constants";

export type TestNotificationKind = "prayer" | "prayer-adhan" | "window" | "friday";

export const TEST_NOTIFICATION_ITEMS: { label: string; value: TestNotificationKind }[] = [
  { label: "Prayer alert", value: "prayer" },
  { label: "Prayer alert with adhan", value: "prayer-adhan" },
  { label: "Window reminder", value: "window" },
  { label: "Friday reminder", value: "friday" },
];

const DELAY_SECONDS = 5;

const MATCH: Record<TestNotificationKind, (p: PlannedNotification) => boolean> = {
  prayer: (p) => p.data.type === "prayer" && p.data.label === "Dhuhr",
  "prayer-adhan": (p) => p.data.type === "prayer" && p.data.label === "Dhuhr",
  window: (p) => p.data.type === "window_reminder" && p.data.label === "Dhuhr",
  friday: (p) => p.data.type === "friday",
};

/**
 * Sends the real notification for `kind` in a few seconds, using the planner's own copy and the
 * user's city and times, so what appears is what a real one looks like. Returns false when
 * notifications aren't allowed or the planner had nothing of that kind.
 */
export async function sendTestNotification(kind: TestNotificationKind): Promise<boolean> {
  if (!__DEV__) return false;
  if (!(await ensureNotificationPermissions())) return false;

  const inputs = await readPlanInputs();
  const windowPrefs = Object.fromEntries(WINDOW_PRAYERS.map((k) => [k, true])) as WindowPrefMap;
  const plan = planNotifications({
    ...inputs,
    prefs: { ...DEFAULT_PREFS, Dhuhr: true },
    windowPrefs,
    fridayEnabled: true,
    prayerSound: kind === "prayer-adhan" && Platform.OS === "ios" ? IOS_SOUND_MAP.adhan : inputs.prayerSound,
    days: inputs.days.map((d) => ({ ...d, statuses: {} })),
    now: 0,
  });
  const found = plan.find(MATCH[kind]);
  if (!found) return false;

  const { fireDate: _fireDate, seenKey: _seenKey, ...content } = found;
  await Notifications.scheduleNotificationAsync({
    content: { ...content, priority: Notifications.AndroidNotificationPriority.HIGH },
    trigger: { type: "timeInterval", seconds: DELAY_SECONDS } as any,
  });
  return true;
}
