import { Platform } from "react-native";

export const SETTINGS_CHANGED_EVENT = "settingsChanged";

export const STORAGE_SCHEDULE_IDS = "notif_schedule_ids_v1";
export const STORAGE_DAYKEY = "notif_daykey_v1";
export const STORAGE_SEEN_KEYS = "notif_seen_keys_v1";

export const STORAGE_CITY_DISPLAY_LOC = "notif_city_display_loc_v1";
export const STORAGE_CITY_DISPLAY_MAN = "notif_city_display_man_v1";
export const STORAGE_LAST_MANUAL_CITY = "notif_last_manual_city_v1";

export const MIDNIGHT_REFRESH_MINUTES = 5;
export const ANDROID_CHANNEL_ID = "prayer-reminders";

const HORIZON_DAYS_IOS = 10;
const HORIZON_DAYS_ANDROID = 14;

export const HORIZON_DAYS =
  Platform.OS === "ios" ? HORIZON_DAYS_IOS : HORIZON_DAYS_ANDROID;
