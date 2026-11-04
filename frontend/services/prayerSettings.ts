import * as Location from "expo-location";

import type { PrayerSettings } from "@/services/prayer-times/types";
import {
  DEFAULT_PRAYER_CITY,
  prayerSettingsSetting,
  type PrayerSettingsValue,
} from "@/services/syncedSettings";

export async function canUseOSLocation(): Promise<boolean> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  const perm = await Location.getForegroundPermissionsAsync();
  return servicesEnabled && perm.status === "granted";
}

/** The prayer settings as they apply on this device right now. Never stored. */
export function toEffectivePrayerSettings(
  chosen: PrayerSettingsValue,
  canUseLocation: boolean,
): PrayerSettings {
  return {
    useLocation: chosen.useLocation && canUseLocation,
    method: chosen.method,
    city: chosen.city ?? DEFAULT_PRAYER_CITY,
  };
}

export async function getEffectivePrayerSettings(): Promise<PrayerSettings> {
  return toEffectivePrayerSettings(await prayerSettingsSetting.get(), await canUseOSLocation());
}
