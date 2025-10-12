// services/notificationService.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { AppState, DeviceEventEmitter, Platform } from "react-native";
import { getPrayerTimesToday, PrayerTime } from "./dailyPrayerTimes";

// -----------------------------
// Events your app already emits
// -----------------------------
export const NOTIF_PREFS_UPDATED_EVENT = "NOTIF_PREFS_UPDATED"; // from NotificationSettings.tsx
const SETTINGS_CHANGED_EVENT = "settingsChanged"; // from Settings screen

// -----------------------------
// Storage keys
// -----------------------------
const STORAGE_ENABLED = "notif_enabled_v1";
const STORAGE_MAP = "notif_map_v1";
const STORAGE_SCHEDULE_IDS = "notif_schedule_ids_v1";
const STORAGE_DAYKEY = "notif_daykey_v1";
const STORAGE_SEEN_KEYS = "notif_seen_keys_v1"; // set of "Label_YYYY-MM-DDTHH:MM"

// Split caches so manual vs location labels never bleed into each other
const STORAGE_CITY_DISPLAY_LOC = "notif_city_display_loc_v1";
const STORAGE_CITY_DISPLAY_MAN = "notif_city_display_man_v1";
const STORAGE_LAST_MANUAL_CITY = "notif_last_manual_city_v1"; // Full manual city cache

// -----------------------------
// Scheduling constants
// -----------------------------
const MIDNIGHT_REFRESH_MINUTES = 5; // Fire at 12:05 AM local to refresh next day
const ANDROID_CHANNEL_ID = "prayer-reminders";

// -----------------------------
// Types & defaults
// -----------------------------
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

type CityLike = {
  name: string;
  lat: number;
  lng: number;
  country?: string;
  id?: string;
};

function isCityLike(x: any): x is CityLike {
  return (
    !!x &&
    typeof x === "object" &&
    typeof x.name === "string" &&
    typeof x.lat !== "undefined" &&
    typeof x.lng !== "undefined" &&
    !Number.isNaN(Number(x.lat)) &&
    !Number.isNaN(Number(x.lng))
  );
}

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

// -----------------------------
// Utils
// -----------------------------
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

function makeSeenKey(label: PrayerKey, fireDate: Date): string {
  // Use minute precision to avoid trivial clock drift
  const k = fireDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  return `${label}_${k}`;
}

// -----------------------------
// Permissions & channels
// -----------------------------
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

// -----------------------------
// Settings & prefs reads
// -----------------------------
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
  city?: CityLike | null;
}> {
  const raw = await AsyncStorage.getItem("prayerSettings");
  if (!raw) return { useLocation: true, method: -1, city: null };
  const parsed = JSON.parse(raw);
  return {
    useLocation: Boolean(parsed.useLocation ?? true),
    method: parsed.method ?? -1,
    city: normalizeCity(parsed.city),
  };
}

// -----------------------------
// Effective settings (match Home)
// -----------------------------
async function canUseOSLocation(): Promise<boolean> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  const perm = await Location.getForegroundPermissionsAsync();
  return servicesEnabled && perm.status === "granted";
}

/**
 * Derive effective settings for this run:
 * - If user toggled location OFF: always use manual city.
 * - If user toggled ON but OS blocks: temporary fallback to manual city.
 * - Pass manual city through even when using location, so dailyPrayerTimes can gracefully fallback.
 */
function deriveEffectiveSettings(
  s: { useLocation: boolean; method: number; city?: CityLike | null },
  canUse: boolean
): { useLocation: boolean; method: number; city?: CityLike | null } {
  const manualCity = s.city ?? null;
  if (!s.useLocation) {
    return { useLocation: false, method: s.method, city: manualCity };
  }
  if (s.useLocation && !canUse) {
    return { useLocation: false, method: s.method, city: manualCity };
  }
  // Location allowed. Provide city as fallback to avoid hard errors if read fails mid-run.
  return { useLocation: true, method: s.method, city: manualCity ?? undefined };
}

// -----------------------------
// City label resolver (manual vs location)
// -----------------------------
/**
 * Resolve a short city-only label for notification titles.
 * - Manual mode: use manual city name; cache under MAN key.
 * - Location mode: try current position quickly; fall back to lastKnown; cache under LOC key.
 */
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
    // fallback to last saved manual display
    const man = await AsyncStorage.getItem(STORAGE_CITY_DISPLAY_MAN);
    if (man) return man;
    // as a last resort, try the legacy manual city object
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

  // Location mode — try to refresh from current position quickly
  try {
    // a gentle attempt; if it throws/timeout, we fall back to last known and cache
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
  } catch {
    // ignore and fall back
  }

  // Fallback to last known
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
  } catch {
    // ignore
  }

  // Use cached location label if we have it
  const cachedLoc = await AsyncStorage.getItem(STORAGE_CITY_DISPLAY_LOC);
  if (cachedLoc) return cachedLoc;

  return "your area";
}

// -----------------------------
// Scheduling helpers
// -----------------------------
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
    const title = [emoji, label, p.time, cityDisplay]
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .join(" • ");

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
    await AsyncStorage.setItem(
      STORAGE_SEEN_KEYS,
      JSON.stringify(Array.from(seen))
    );
  }
}

// -----------------------------
// Fetch today's times with strict manual-vs-location handling
// -----------------------------
async function fetchTodayTimesWithEffective(): Promise<{
  times: PrayerTime[];
  effective: { useLocation: boolean; method: number; city?: CityLike | null };
}> {
  const s = await readPrayerSettings();
  const canUse = await canUseOSLocation();
  const effective = deriveEffectiveSettings(s, canUse);

  // Always pass the fallback city through; dailyPrayerTimes handles the rest.
  const times = await getPrayerTimesToday({
    useLocation: effective.useLocation,
    method: effective.method,
    city: effective.city || undefined,
  });

  return { times, effective };
}

// -----------------------------
// Midnight rescheduler & listeners
// -----------------------------
let midnightTimer: any = null;
let rescheduleInProgress = false;
let initDone = false; // prevents double init and duplicate listeners

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

// -----------------------------
// Public service
// -----------------------------
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
        // Below two are iOS-specific; Expo ignores when not applicable
        shouldShowBanner: true as any,
        shouldShowList: true as any,
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
      const { times, effective } = await fetchTodayTimesWithEffective();
      const cityDisplay = await resolveCityDisplay(effective);

      const today = yyyymmdd();
      const timesFingerprint = JSON.stringify(
        times.map((t) => [t.label, t.time])
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
      const nextDayKey = `day_${today}_${JSON.stringify(
        prefs
      )}_${cityDisplay}_${timesFingerprint}_${effFingerprint}`;
      const lastDayKey = (await AsyncStorage.getItem(STORAGE_DAYKEY)) || "";

      // Only skip on truly "light" triggers
      const canSkip = reason === "app-foreground" || reason === "init";

      if (canSkip && lastDayKey === nextDayKey) {
        // Nothing changed for today, leave existing schedules intact
        return;
      }

      await scheduleForToday(times, prefs, true, cityDisplay);
      await AsyncStorage.setItem(STORAGE_DAYKEY, nextDayKey);
    } catch (e) {
      // On hard failures, clear to avoid stale schedules
      console.warn("rescheduleAll failed:", e);
      try {
        await cancelPreviouslyScheduled();
      } catch {}
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
