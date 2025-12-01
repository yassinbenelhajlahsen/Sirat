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

export const SOUND_SEGMENT_GAP = 10;

export const NOTIF_PREFS_UPDATED_EVENT = "NOTIF_PREFS_UPDATED";

export const DEFAULT_PREFS = PRAYERS.reduce<Record<PrayerKey, boolean>>(
  (acc, key) => {
    acc[key] = true;
    return acc;
  },
  {} as Record<PrayerKey, boolean>
);
