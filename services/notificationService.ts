// services/notificationService.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";
import { getPrayerTimesToday, PrayerTime } from "./dailyPrayerTimes"; // adjust path if needed

// Events your app already emits
export const NOTIF_PREFS_UPDATED_EVENT = "NOTIF_PREFS_UPDATED"; // from NotificationSettings.tsx
const SETTINGS_CHANGED_EVENT = "settingsChanged"; // from Settings screen

// Storage keys (match your NotificationSettings)
const STORAGE_ENABLED = "notif_enabled_v1";
const STORAGE_MAP = "notif_map_v1";

// Internal storage to track scheduled notification IDs so we can cancel them
const STORAGE_SCHEDULE_IDS = "notif_schedule_ids_v1";

// Fire at 12:05 AM local to refresh next day’s notifications
const MIDNIGHT_REFRESH_MINUTES = 5;

// Android channel
const ANDROID_CHANNEL_ID = "prayer-reminders";

// Types
type PrayerKey = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
type PrefMap = Record<PrayerKey, boolean>;

const DEFAULT_PREFS: PrefMap = {
  Fajr: true,
  Sunrise: false,
  Dhuhr: true,
  Asr: true,
  Maghrib: true,
  Isha: true,
};

function parse12hToTodayDate(timeStr: string): Date {
  // input like "5:23 AM"
  const [hm, ampm] = timeStr.split(" ");
  const [hStr, mStr] = hm.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  const now = new Date();
  const dt = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    h,
    m,
    0,
    0
  );
  return dt;
}

function msUntilNextLocalMidnightPlus(minutes: number): number {
  const now = new Date();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    minutes,
    0,
    0
  );
  return Math.max(1000, next.getTime() - now.getTime());
}

async function ensurePermissions(): Promise<boolean> {
  if (!Device.isDevice) return true; // simulators can be flaky but allow scheduling
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  const req = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowSound: true,
      allowBadge: true,
    },
  });
  return req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

async function configureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Prayer reminders",
    importance: Notifications.AndroidImportance.HIGH,
    bypassDnd: false,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function readMasterEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_ENABLED);
  return raw === "1";
}

async function readPrefs(): Promise<PrefMap> {
  const raw = await AsyncStorage.getItem(STORAGE_MAP);
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
}

async function readPrayerSettings(): Promise<{
  useLocation: boolean;
  method: number;
  city?: any;
}> {
  const raw = await AsyncStorage.getItem("prayerSettings");
  if (!raw) return { useLocation: true, method: 2 };
  const parsed = JSON.parse(raw);
  return {
    useLocation: parsed.useLocation ?? true,
    method: parsed.method ?? 2,
    city: parsed.city, // retained for manual city mode
  };
}

async function cancelPreviouslyScheduled() {
  const raw = await AsyncStorage.getItem(STORAGE_SCHEDULE_IDS);
  if (raw) {
    const ids: string[] = JSON.parse(raw);
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  }
  await AsyncStorage.removeItem(STORAGE_SCHEDULE_IDS);
}

async function scheduleForToday(prayers: PrayerTime[], prefs: PrefMap, enabled: boolean) {
  await cancelPreviouslyScheduled();

  if (!enabled) return;

  const ids: string[] = [];
  for (const p of prayers) {
    const label = p.label as PrayerKey;
    if (!prefs[label]) continue;

    const fireDate = parse12hToTodayDate(p.time);
    const now = new Date();

    // If time already passed today, skip. We only schedule same-day alarms here.
    if (fireDate.getTime() <= now.getTime()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${label} time`,
        body: `It is time for ${label}.`,
        sound: Platform.select({ ios: "default", android: "default" }),
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: fireDate, // one-off local schedule
    });

    ids.push(id);
  }

  if (ids.length) {
    await AsyncStorage.setItem(STORAGE_SCHEDULE_IDS, JSON.stringify(ids));
  }
}

let midnightTimer: NodeJS.Timeout | null = null;

function startMidnightRescheduler() {
  if (midnightTimer) clearTimeout(midnightTimer as any);
  midnightTimer = setTimeout(async () => {
    // At midnight+X, compute new set of schedules
    await NotificationService.rescheduleAll("midnight");
    // schedule next tick
    startMidnightRescheduler();
  }, msUntilNextLocalMidnightPlus(MIDNIGHT_REFRESH_MINUTES));
}

async function fetchTodayTimes(): Promise<PrayerTime[]> {
  const s = await readPrayerSettings();
  return getPrayerTimesToday({
    useLocation: s.useLocation,
    method: s.method,
    city: s.city,
  });
}

function attachEventListeners() {
  // Preferences toggled in NotificationSettings
  DeviceEventEmitter.addListener(NOTIF_PREFS_UPDATED_EVENT, () => {
    NotificationService.rescheduleAll("notif-prefs-changed").catch(() => {});
  });

  // Calculation method / city / location toggled in Settings
  DeviceEventEmitter.addListener(SETTINGS_CHANGED_EVENT, () => {
    NotificationService.rescheduleAll("settings-changed").catch(() => {});
  });

  // Re-evaluate when app comes to foreground
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      NotificationService.rescheduleAll("app-foreground").catch(() => {});
    }
  });
}

export const NotificationService = {
  /**
   * Call once on app startup (e.g., in your root layout).
   */
  async init() {
    // Required for Android channels
    await configureAndroidChannel();

    // Recommended foreground behavior (optional: customize as you like)
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    attachEventListeners();
    startMidnightRescheduler();

    // Initial schedule on boot
    await this.rescheduleAll("init");
  },

  /**
   * Reschedules all notifications for today based on current settings and prefs.
   * This is safe to call frequently. It cancels old schedules and creates fresh ones.
   */
  async rescheduleAll(reason: "init" | "midnight" | "notif-prefs-changed" | "settings-changed" | "app-foreground") {
    const enabled = await readMasterEnabled();
    const hasPerm = await ensurePermissions();

    if (!hasPerm || !enabled) {
      await cancelPreviouslyScheduled();
      return;
    }

    const prefs = await readPrefs();
    const times = await fetchTodayTimes();

    await scheduleForToday(times, prefs, enabled);
  },

  /**
   * Manually disable and clear all scheduled notifications.
   */
  async cancelAll() {
    await cancelPreviouslyScheduled();
  },
};
