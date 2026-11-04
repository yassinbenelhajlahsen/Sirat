export type PrayerKey =
  | "Fajr"
  | "Sunrise"
  | "Dhuhr"
  | "Asr"
  | "Maghrib"
  | "Isha";

export const PRAYERS: PrayerKey[] = [
  "Fajr",
  "Sunrise",
  "Dhuhr",
  "Asr",
  "Maghrib",
  "Isha",
];

export const STORAGE_ENABLED = "notif_enabled_v1";
export const STORAGE_MAP = "notif_map_v1";
export const STORAGE_SOUND_MODE = "notif_sound_mode_v1";

export type SoundMode = "default" | "adhan";

export const SOUND_OPTIONS: {
  id: SoundMode;
  label: string;
  description?: string;
}[] = [
  {
    id: "default",
    label: "System default",
  },
  {
    id: "adhan",
    label: "Adhan",
    description: "A short, subtle Adhan clip.",
  },
];

export const NOTIF_PREFS_UPDATED_EVENT = "NOTIF_PREFS_UPDATED";

// Granular per-setting change signals, emitted only on a real edit to that one
// value (unlike NOTIF_PREFS_UPDATED, which also broadcasts on launch and on
// master-toggle / OS-permission changes). The sync engine stamps each synced
// notif setting off its own event so an unrelated change never bumps its stamp.
export const NOTIF_MAP_CHANGED_EVENT = "NOTIF_MAP_CHANGED";
export const NOTIF_SOUND_MODE_CHANGED_EVENT = "NOTIF_SOUND_MODE_CHANGED";
export const NOTIF_WINDOW_MAP_CHANGED_EVENT = "NOTIF_WINDOW_MAP_CHANGED";
export const NOTIF_WINDOW_OFFSET_CHANGED_EVENT = "NOTIF_WINDOW_OFFSET_CHANGED";
export const NOTIF_FRIDAY_CHANGED_EVENT = "NOTIF_FRIDAY_CHANGED";
export const NOTIF_SUHOOR_CHANGED_EVENT = "NOTIF_SUHOOR_CHANGED";
export const NOTIF_SUHOOR_OFFSET_CHANGED_EVENT = "NOTIF_SUHOOR_OFFSET_CHANGED";
export const RAMADAN_MODE_CHANGED_EVENT = "RAMADAN_MODE_CHANGED";

export const DEFAULT_PREFS = PRAYERS.reduce<Record<PrayerKey, boolean>>(
  (acc, key) => {
    acc[key] = true;
    return acc;
  },
  {} as Record<PrayerKey, boolean>
);

export type WindowPrayerKey = "Fajr" | "Dhuhr" | "Asr" | "Maghrib";

export const WINDOW_PRAYERS: WindowPrayerKey[] = [
  "Fajr",
  "Dhuhr",
  "Asr",
  "Maghrib",
];

export const WINDOW_OFFSET_OPTIONS = [5, 15, 20, 30] as const;

export const DEFAULT_WINDOW_OFFSET = 15;

export const STORAGE_WINDOW_MAP = "notif_window_map_v1";
export const STORAGE_WINDOW_OFFSET = "notif_window_offset_v1";
// "1"/"0"; a missing value means on.
export const STORAGE_FRIDAY = "notif_friday_v1";

export type WindowPrefMap = Record<WindowPrayerKey, boolean>;

export const DEFAULT_WINDOW_PREFS: WindowPrefMap = WINDOW_PRAYERS.reduce(
  (acc, key) => {
    acc[key] = false;
    return acc;
  },
  {} as WindowPrefMap,
);

export const SUHOOR_OFFSET_OPTIONS = [15, 30, 45, 60] as const;
export const DEFAULT_SUHOOR_OFFSET = 30;
// Off until the user asks: the reminder is new and wakes people up.
export const DEFAULT_SUHOOR_ENABLED = false;

export const STORAGE_SUHOOR = "notif_suhoor_v1";
export const STORAGE_SUHOOR_OFFSET = "notif_suhoor_offset_v1";
export const STORAGE_RAMADAN_MODE = "ramadan_mode_v1";
