// services/notificationService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { AppState, DeviceEventEmitter, Platform } from "react-native";
import { getPrayerTimesToday, PrayerTime } from "./dailyPrayerTimes";

// Events your app already emits
export const NOTIF_PREFS_UPDATED_EVENT = "NOTIF_PREFS_UPDATED"; // from NotificationSettings.tsx
const SETTINGS_CHANGED_EVENT = "settingsChanged"; // from Settings screen

// Storage keys
const STORAGE_ENABLED = "notif_enabled_v1";
const STORAGE_MAP = "notif_map_v1";
const STORAGE_SCHEDULE_IDS = "notif_schedule_ids_v1";

// Duplicate protection keys
const STORAGE_DAYKEY = "notif_daykey_v1";
const STORAGE_SEEN_KEYS = "notif_seen_keys_v1"; // set of "Label_YYYY-MM-DDTHH:MM"

// Cache for display city when using location mode
const STORAGE_CITY_DISPLAY = "notif_last_city_v1";

// Fire at 12:05 AM local to refresh next day
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

const PRAYER_EMOJI: Record<PrayerKey, string> = {
  Fajr: "🌅",
  Sunrise: "🌞",
  Dhuhr: "☀️",
  Asr: "🕔",
  Maghrib: "🌇",
  Isha: "🌙",
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
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
}

function yyyymmdd(d = new Date()): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  if (!Device.isDevice) return true; // allow on simulators
  const settings = await Notifications.getPermissionsAsync();
  if (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  });
  return (
    req.granted ||
    req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
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
    city: parsed.city,
  };
}

// Try to get a nice display location for the notification title
async function resolveCityDisplay(): Promise<string> {
  // 1) manual city if set
  const s = await readPrayerSettings();
  if (s.city?.name) {
    const region = s.city?.region || s.city?.state || s.city?.country || "";
    const regionPart = region ? `, ${region}` : "";
    const label = `${s.city.name}${regionPart}`;
    await AsyncStorage.setItem(STORAGE_CITY_DISPLAY, label);
    return label;
  }

  // 2) cached from previous reverse geocode
  const cached = await AsyncStorage.getItem(STORAGE_CITY_DISPLAY);
  if (cached) return cached;

  // 3) best effort reverse geocode once, cache it
  try {
    const last = await Location.getLastKnownPositionAsync({});
    if (last) {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
      });
      if (place) {
        const city = place.city || place.subregion || place.region || "";
        const region = place.region || place.country || "";
        const label = city ? `${city}${region ? `, ${region}` : ""}` : region;
        if (label) {
          await AsyncStorage.setItem(STORAGE_CITY_DISPLAY, label);
          return label;
        }
      }
    }
  } catch {
    // ignore failures, we will fall back
  }

  return "your area";
}

async function cancelPreviouslyScheduled() {
  // Clear OS scheduled notifications
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // best effort
  }

  // Clear any IDs we tracked
  const raw = await AsyncStorage.getItem(STORAGE_SCHEDULE_IDS);
  if (raw) {
    const ids: string[] = JSON.parse(raw);
    await Promise.all(
      ids.map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
      )
    );
  }

  await AsyncStorage.multiRemove([STORAGE_SCHEDULE_IDS, STORAGE_SEEN_KEYS]);
}

function makeSeenKey(label: PrayerKey, fireDate: Date): string {
  // Use minute precision to avoid trivial clock drift
  const k = fireDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return `${label}_${k}`;
}

async function scheduleForToday(
  prayers: PrayerTime[],
  prefs: PrefMap,
  enabled: boolean,
  cityDisplay: string
) {
  await cancelPreviouslyScheduled();
  if (!enabled) return;

  const ids: string[] = [];
  const today = yyyymmdd();
  const dayKey = `day_${today}`;

  // Keep a set of scheduled keys to prevent duplicates even if this runs twice
  const seenRaw = await AsyncStorage.getItem(STORAGE_SEEN_KEYS);
  const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);

  for (const p of prayers) {
    const label = p.label as PrayerKey;
    if (!prefs[label]) continue;

    const fireDate = parse12hToTodayDate(p.time);
    const now = new Date();

    // Skip past times for today
    if (fireDate.getTime() <= now.getTime()) continue;

    // Duplicate guard
    const sk = makeSeenKey(label, fireDate);
    if (seen.has(sk)) continue;

    const emoji = PRAYER_EMOJI[label] || "🕌";
    const titleParts = [emoji, label, p.time, cityDisplay].filter(Boolean);
    const title = titleParts.join(" • ");

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: `It is time for ${label}.`,
        sound: Platform.select({ ios: "default", android: "default" }),
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          type: "prayer",
          label,
          timeLocal: p.time,
          city: cityDisplay,
          dayKey,
        },
        subtitle: Platform.OS === "ios" ? "Prayer reminder" : undefined,
      },
      trigger: {
        type: "date",
        date: fireDate,
      } as unknown as Notifications.NotificationTriggerInput,
    });

    ids.push(id);
    seen.add(sk);
  }

  if (ids.length) {
    await AsyncStorage.setItem(STORAGE_SCHEDULE_IDS, JSON.stringify(ids));
  }
  await AsyncStorage.setItem(STORAGE_DAYKEY, dayKey);
  await AsyncStorage.setItem(STORAGE_SEEN_KEYS, JSON.stringify([...seen]));
}

let midnightTimer: number | null = null;
let rescheduleInProgress = false;
let initDone = false; // prevents double init and duplicate listeners

function startMidnightRescheduler() {
  if (midnightTimer) clearTimeout(midnightTimer as any);
  midnightTimer = setTimeout(async () => {
    await NotificationService.rescheduleAll("midnight");
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
  // These listeners cause reschedules. Guarded by initDone so we attach once.
  DeviceEventEmitter.addListener(NOTIF_PREFS_UPDATED_EVENT, () => {
    NotificationService.rescheduleAll("notif-prefs-changed").catch(() => {});
  });

  DeviceEventEmitter.addListener(SETTINGS_CHANGED_EVENT, () => {
    NotificationService.rescheduleAll("settings-changed").catch(() => {});
  });

  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      NotificationService.rescheduleAll("app-foreground").catch(() => {});
    }
  });
}

export const NotificationService = {
  /**
   * Call once on app startup, for example in your root layout.
   */
  async init() {
    if (initDone) return; // prevent duplicate listeners and timers
    initDone = true;

    await configureAndroidChannel();

    // Foreground behavior
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    attachEventListeners();
    startMidnightRescheduler();

    // First schedule on boot
    await this.rescheduleAll("init");
  },

  /**
   * Reschedules all notifications for today based on current settings and prefs.
   * Safe to call often. Cancels old schedules and creates fresh ones.
   * Includes duplicate protection and a day-key shortcut to avoid redundant work.
   */
  async rescheduleAll(
    reason:
      | "init"
      | "midnight"
      | "notif-prefs-changed"
      | "settings-changed"
      | "app-foreground"
  ) {
    if (rescheduleInProgress) return;
    rescheduleInProgress = true;
    try {
      const enabled = await readMasterEnabled();
      const hasPerm = await ensurePermissions();

      if (!hasPerm || !enabled) {
        await cancelPreviouslyScheduled();
        return;
      }

      const prefs = await readPrefs();
      const times = await fetchTodayTimes();
      const cityDisplay = await resolveCityDisplay();

      // Shortcut to avoid needless churn when nothing changed
      const today = yyyymmdd();
      const nextDayKey = `day_${today}_${JSON.stringify(prefs)}_${cityDisplay}`;
      const lastDayKey = (await AsyncStorage.getItem(STORAGE_DAYKEY)) || "";

      // Only skip on light triggers to avoid missing changes
      const canSkip =
        reason === "app-foreground" ||
        reason === "init" ||
        reason === "settings-changed";

      if (canSkip && lastDayKey === nextDayKey) {
        // Nothing changed for today, leave existing schedules intact
        return;
      }

      await scheduleForToday(times, prefs, true, cityDisplay);
      await AsyncStorage.setItem(STORAGE_DAYKEY, nextDayKey);
    } finally {
      rescheduleInProgress = false;
    }
  },

  /**
   * Manually disable and clear all scheduled notifications.
   */
  async cancelAll() {
    await cancelPreviouslyScheduled();
  },
};
