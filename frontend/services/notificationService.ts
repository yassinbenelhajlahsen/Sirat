// services/notificationService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { AppState, DeviceEventEmitter, Platform } from "react-native";
import {
  getPrayerTimesForDate,
  getPrayerTimesToday,
  PrayerSettings,
  PrayerTime,
} from "./prayerTimes";

/** -----------------------------
 * Events your app already emits
 * -----------------------------*/
export const NOTIF_PREFS_UPDATED_EVENT = "NOTIF_PREFS_UPDATED"; // from NotificationSettings.tsx
const SETTINGS_CHANGED_EVENT = "settingsChanged"; // from Settings screen

/** -----------------------------
 * Storage keys
 * -----------------------------*/
const STORAGE_ENABLED = "notif_enabled_v1";
const STORAGE_MAP = "notif_map_v1";
const STORAGE_SCHEDULE_IDS = "notif_schedule_ids_v1";
const STORAGE_DAYKEY = "notif_daykey_v1";
const STORAGE_SEEN_KEYS = "notif_seen_keys_v1"; // set of "Label_YYYY-MM-DDTHH:MM"
const STORAGE_SOUND_MODE = "notif_sound_mode_v1";

// Split caches so manual vs location labels never bleed into each other
const STORAGE_CITY_DISPLAY_LOC = "notif_city_display_loc_v1";
const STORAGE_CITY_DISPLAY_MAN = "notif_city_display_man_v1";
const STORAGE_LAST_MANUAL_CITY = "notif_last_manual_city_v1"; // Full manual city cache

/** -----------------------------
 * Scheduling constants
 * -----------------------------*/
const MIDNIGHT_REFRESH_MINUTES = 5; // 12:05 AM local
const ANDROID_CHANNEL_ID = "prayer-reminders";

// Rolling horizon (Plan A)
const HORIZON_DAYS_IOS = 10; // 6 prayers/day * 10 = 60 <= iOS 64 cap
const HORIZON_DAYS_ANDROID = 14;
const HORIZON_DAYS =
  Platform.OS === "ios" ? HORIZON_DAYS_IOS : HORIZON_DAYS_ANDROID;

/** -----------------------------
 * Types & defaults
 * -----------------------------*/
type PrayerKey = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
type PrefMap = Record<PrayerKey, boolean>;

const DEFAULT_PREFS: PrefMap = {
  Fajr: true,
  Sunrise: true,
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

type CityLike = {
  name: string;
  lat: number;
  lng: number;
  country?: string;
  id?: string;
};

type SoundMode = "default" | "adhan";

const IOS_SOUND_MAP: Record<SoundMode, string> = {
  default: "default",
  adhan: "adhan.wav",
};

function normalizeCity(raw: any): CityLike | null {
  if (!raw) return null;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const lat = Number(candidate?.lat);
  const lng = Number(candidate?.lng);
  if (
    typeof candidate?.name === "string" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng)
  ) {
    return {
      name: candidate.name.trim(),
      lat,
      lng,
      country: candidate.country,
      id: candidate.id,
    };
  }
  return null;
}

/** -----------------------------
 * Utils
 * -----------------------------*/
function parse12hToDate(base: Date, timeStr: string): Date {
  // timeStr like "5:23 AM"
  const [hm, ampm] = timeStr.split(" ");
  const [hStr, mStr] = hm.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    h,
    m,
    0,
    0
  );
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

function makeSeenKey(label: PrayerKey, fireDate: Date): string {
  // minute precision
  const k = fireDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return `${label}_${k}`;
}

async function readSoundMode(): Promise<SoundMode> {
  const raw = await AsyncStorage.getItem(STORAGE_SOUND_MODE);
  if (
    raw === "adhan"
  ) {
    return raw;
  }
  return "default";
}

/** -----------------------------
 * Permissions & channels
 * -----------------------------*/
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

/** -----------------------------
 * Settings & prefs reads
 * -----------------------------*/
async function readMasterEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(STORAGE_ENABLED);
  return raw === "1";
}

async function readPrefs(): Promise<PrefMap> {
  const raw = await AsyncStorage.getItem(STORAGE_MAP);
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
}

async function readPrayerSettings(): Promise<
  Omit<PrayerSettings, "city"> & { city?: CityLike | null }
> {
  const raw = await AsyncStorage.getItem("prayerSettings");
  if (!raw)
    return { useLocation: true, method: -1, city: null } as Omit<
      PrayerSettings,
      "city"
    > & { city?: CityLike | null };
  const parsed = JSON.parse(raw);
  return {
    useLocation: Boolean(parsed.useLocation ?? true),
    method: parsed.method ?? -1,
    city: normalizeCity(parsed.city),
  } as Omit<PrayerSettings, "city"> & { city?: CityLike | null };
}

/** -----------------------------
 * Effective settings (match Home)
 * -----------------------------*/
async function canUseOSLocation(): Promise<boolean> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  const perm = await Location.getForegroundPermissionsAsync();
  return servicesEnabled && perm.status === "granted";
}

function deriveEffectiveSettings(
  s: { useLocation: boolean; method: number; city?: CityLike | null },
  canUse: boolean
): PrayerSettings {
  const manualCity = s.city ?? null;
  if (!s.useLocation) {
    return { useLocation: false, method: s.method, city: manualCity as any };
  }
  if (s.useLocation && !canUse) {
    return { useLocation: false, method: s.method, city: manualCity as any };
  }
  // Location allowed. Provide city as fallback for other screens if needed.
  return { useLocation: true, method: s.method, city: manualCity as any };
}

/** -----------------------------
 * City label resolver (manual vs location)
 * -----------------------------*/
async function resolveCityDisplay(effective: {
  useLocation: boolean;
  city?: CityLike | null;
}): Promise<string> {
  if (!effective.useLocation) {
    const city = effective.city;
    if (city?.name) {
      await AsyncStorage.setItem(STORAGE_CITY_DISPLAY_MAN, city.name);
      await AsyncStorage.setItem(
        STORAGE_LAST_MANUAL_CITY,
        JSON.stringify(city)
      );
      return city.name;
    }
    const man = await AsyncStorage.getItem(STORAGE_CITY_DISPLAY_MAN);
    if (man) return man;
    const lastManualRaw = await AsyncStorage.getItem(STORAGE_LAST_MANUAL_CITY);
    if (lastManualRaw) {
      try {
        const lastManual = normalizeCity(JSON.parse(lastManualRaw));
        if (lastManual?.name) {
          await AsyncStorage.setItem(STORAGE_CITY_DISPLAY_MAN, lastManual.name);
          return lastManual.name;
        }
      } catch {}
    }
    return "your area";
  }

  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      maximumAge: 15_000,
      timeout: 2_500,
    } as any);
    if (loc) {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      if (place) {
        const locality =
          place.city ||
          (place as any).subregion ||
          (place as any).district ||
          (place as any).name ||
          "";
        const label = String(locality).trim() || "your area";
        await AsyncStorage.setItem(STORAGE_CITY_DISPLAY_LOC, label);
        return label;
      }
    }
  } catch {}

  try {
    const last = await Location.getLastKnownPositionAsync({});
    if (last) {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: last.coords.latitude,
        longitude: last.coords.longitude,
      });
      if (place) {
        const locality =
          place.city ||
          (place as any).subregion ||
          (place as any).district ||
          (place as any).name ||
          "";
        const label = String(locality).trim() || "your area";
        await AsyncStorage.setItem(STORAGE_CITY_DISPLAY_LOC, label);
        return label;
      }
    }
  } catch {}

  const cachedLoc = await AsyncStorage.getItem(STORAGE_CITY_DISPLAY_LOC);
  if (cachedLoc) return cachedLoc;

  return "your area";
}

/** -----------------------------
 * Scheduling helpers
 * -----------------------------*/
async function cancelPreviouslyScheduled() {
  // Clear OS schedules
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {}

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

function addDays(d: Date, offset: number) {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + offset,
    0,
    0,
    0,
    0
  );
}

/**
 * Schedule a rolling horizon starting today for N days.
 * Does not wipe existing future schedules; relies on STORAGE_SEEN_KEYS to avoid duplicates.
 */
async function scheduleForHorizon(
  days: number,
  prefs: PrefMap,
  cityDisplay: string,
  effective: PrayerSettings,
  soundMode: SoundMode
) {
  const now = Date.now();

  const seenRaw = await AsyncStorage.getItem(STORAGE_SEEN_KEYS);
  const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);

  const scheduledIdsRaw = await AsyncStorage.getItem(STORAGE_SCHEDULE_IDS);
  const scheduledIds = new Set<string>(
    scheduledIdsRaw ? JSON.parse(scheduledIdsRaw) : []
  );
  const idsToPersist: string[] = Array.from(scheduledIds);

  for (let d = 0; d < days; d++) {
    const day = addDays(new Date(), d);
    const times: PrayerTime[] = await getPrayerTimesForDate(effective, day);

    for (const p of times) {
      const label = p.label as PrayerKey;
      if (!prefs[label]) continue;

      const fireDate = parse12hToDate(day, p.time);
      if (fireDate.getTime() <= now) continue;

      const sk = makeSeenKey(label, fireDate);
      if (seen.has(sk)) continue;

      const iosSound = IOS_SOUND_MAP[soundMode] ?? "default";
      const triggerSound = Platform.OS === "ios" ? iosSound : "default";

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${PRAYER_EMOJI[label] || "🕌"} ${label} • ${
            p.time
          } • ${cityDisplay}`,
          body: "",
          sound: triggerSound,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: {
            type: "prayer",
            label,
            timeLocal: p.time,
            city: cityDisplay,
            dayKey: yyyymmdd(day),
          },
        },
        trigger: { type: "date", date: fireDate } as any,
      });

      seen.add(sk);
      idsToPersist.push(id);
    }
  }

  await AsyncStorage.setItem(
    STORAGE_SCHEDULE_IDS,
    JSON.stringify(idsToPersist)
  );
  await AsyncStorage.setItem(
    STORAGE_SEEN_KEYS,
    JSON.stringify(Array.from(seen))
  );
}

/** -----------------------------
 * Fetch today's times with strict manual-vs-location handling
 * -----------------------------*/
async function fetchTodayTimesWithEffective(): Promise<{
  times: PrayerTime[];
  effective: PrayerSettings;
}> {
  const s = await readPrayerSettings();
  const canUse = await canUseOSLocation();
  const effective = deriveEffectiveSettings(s, canUse);
  const times = await getPrayerTimesToday(effective);
  return { times, effective };
}

/** -----------------------------
 * Midnight rescheduler & listeners
 * -----------------------------*/
let midnightTimer: any = null;
let rescheduleInProgress = false;
let initDone = false;

function startMidnightRescheduler() {
  if (midnightTimer) clearTimeout(midnightTimer);
  midnightTimer = setTimeout(async () => {
    await NotificationService.rescheduleAll("midnight");
    startMidnightRescheduler();
  }, msUntilNextLocalMidnightPlus(MIDNIGHT_REFRESH_MINUTES));
}

function attachEventListeners() {
  if ((attachEventListeners as any)._attached) return;
  (attachEventListeners as any)._attached = true;

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

/** -----------------------------
 * Public service
 * -----------------------------*/
export const NotificationService = {
  /** Call once on app startup, for example in your root layout. */
  async init() {
    if (initDone) return;
    initDone = true;

    await configureAndroidChannel();

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true as any, // iOS only; safe no-op elsewhere
        shouldShowList: true as any, // iOS only; safe no-op elsewhere
      }),
    });

    attachEventListeners();
    startMidnightRescheduler();

    await this.rescheduleAll("init");
  },

  /**
   * Reschedules notifications using a rolling horizon.
   * Heavy triggers wipe and rebuild. Light triggers top up.
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
      const { times: todayTimes, effective } =
        await fetchTodayTimesWithEffective();
      const cityDisplay = await resolveCityDisplay(effective);
      const soundMode = await readSoundMode();

      // Fingerprint: when this changes, do heavy rebuild
      const today = yyyymmdd();
      const timesFingerprint = JSON.stringify(
        todayTimes.map((t) => [t.label, t.time])
      );
      const effFingerprint = JSON.stringify({
        useLocation: effective.useLocation,
        city: effective.city
          ? {
              n: effective.city.name,
              lat: effective.city.lat,
              lng: effective.city.lng,
            }
          : null,
      });
      const nextKey = `day_${today}_${JSON.stringify(
        prefs
      )}_${cityDisplay}_${timesFingerprint}_${effFingerprint}_${soundMode}`;
      const lastKey = (await AsyncStorage.getItem(STORAGE_DAYKEY)) || "";

      const heavy =
        reason === "notif-prefs-changed" || reason === "settings-changed";

      if (heavy || lastKey !== nextKey) {
        // Full rebuild: clear and seed horizon
        await cancelPreviouslyScheduled();
        await scheduleForHorizon(
          HORIZON_DAYS,
          prefs,
          cityDisplay,
          effective,
          soundMode
        );
        await AsyncStorage.setItem(STORAGE_DAYKEY, nextKey);
        return;
      }

      // Light path: keep existing future notifications; add any missing ones
      await scheduleForHorizon(
        HORIZON_DAYS,
        prefs,
        cityDisplay,
        effective,
        soundMode
      );

      // Optional: pruning of past-due entries could be added here if desired.
    } catch (e) {
      console.warn("rescheduleAll failed:", e);
      try {
        await cancelPreviouslyScheduled();
      } catch {}
    } finally {
      rescheduleInProgress = false;
    }
  },

  /** Manually disable and clear all scheduled notifications. */
  async cancelAll() {
    await cancelPreviouslyScheduled();
  },
};
