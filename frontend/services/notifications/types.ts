import type { PrayerSettings } from "../prayerTimes";
import {
  DEFAULT_PREFS,
  type PrayerKey,
  type SoundMode,
} from "../../utils/notifications/constants";

export { DEFAULT_PREFS };
export type { PrayerKey, SoundMode };

export type PrefMap = Record<PrayerKey, boolean>;

export type CityLike = {
  name: string;
  lat: number;
  lng: number;
  country?: string;
  id?: string;
};

export type RawPrayerSettings = Omit<PrayerSettings, "city"> & {
  city?: CityLike | null;
};

export const PRAYER_EMOJI: Record<PrayerKey, string> = {
  Fajr: "🌅",
  Sunrise: "🌞",
  Dhuhr: "☀️",
  Asr: "🕔",
  Maghrib: "🌇",
  Isha: "🌙",
};

export const IOS_SOUND_MAP: Record<SoundMode, string> = {
  default: "default",
  adhan: "adhan.wav",
};

export type RescheduleReason =
  | "init"
  | "midnight"
  | "notif-prefs-changed"
  | "settings-changed"
  | "app-foreground";
