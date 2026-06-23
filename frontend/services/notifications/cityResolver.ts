import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import type { PrayerSettings } from "../prayerTimes";
import {
  STORAGE_CITY_DISPLAY_LOC,
  STORAGE_CITY_DISPLAY_MAN,
  STORAGE_LAST_MANUAL_CITY,
} from "./constants";
import { type RawPrayerSettings } from "./types";
import { buildEffectiveSettings, normalizeCity } from "./storage";

export async function canUseOSLocation(): Promise<boolean> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  const perm = await Location.getForegroundPermissionsAsync();
  return servicesEnabled && perm.status === "granted";
}

export function deriveEffectiveSettings(
  settings: RawPrayerSettings,
  canUseLocation: boolean,
): PrayerSettings {
  return buildEffectiveSettings(settings, canUseLocation);
}

async function reverseGeocodeToLabel(coords: {
  latitude: number;
  longitude: number;
}): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync(coords);
    if (!place) return null;

    const locality =
      place.city ||
      (place as { subregion?: string }).subregion ||
      (place as { district?: string }).district ||
      (place as { name?: string }).name ||
      "";

    const label = String(locality).trim() || "your area";
    await AsyncStorage.setItem(STORAGE_CITY_DISPLAY_LOC, label);
    return label;
  } catch {
    return null;
  }
}

export async function resolveCityDisplay(
  effective: {
    useLocation: boolean;
    city?: {
      name?: string;
    } | null;
  },
  coords?: { latitude: number; longitude: number },
): Promise<string> {
  if (!effective.useLocation) {
    const city = effective.city;
    if (city?.name) {
      await AsyncStorage.setItem(STORAGE_CITY_DISPLAY_MAN, city.name);
      await AsyncStorage.setItem(STORAGE_LAST_MANUAL_CITY, JSON.stringify(city));
      return city.name;
    }

    const manualLabel = await AsyncStorage.getItem(STORAGE_CITY_DISPLAY_MAN);
    if (manualLabel) return manualLabel;

    const lastManualRaw = await AsyncStorage.getItem(STORAGE_LAST_MANUAL_CITY);
    if (lastManualRaw) {
      try {
        const lastManual = normalizeCity(JSON.parse(lastManualRaw));
        if (lastManual?.name) {
          await AsyncStorage.setItem(STORAGE_CITY_DISPLAY_MAN, lastManual.name);
          return lastManual.name;
        }
      } catch {
        // no-op
      }
    }

    return "your area";
  }

  if (coords) {
    const fromCaller = await reverseGeocodeToLabel(coords);
    if (fromCaller) return fromCaller;
  }

  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      maximumAge: 15_000,
      timeout: 2_500,
    } as any);

    if (loc) {
      const label = await reverseGeocodeToLabel(loc.coords);
      if (label) return label;
    }
  } catch {
    // no-op
  }

  try {
    const last = await Location.getLastKnownPositionAsync({});
    if (last) {
      const label = await reverseGeocodeToLabel(last.coords);
      if (label) return label;
    }
  } catch {
    // no-op
  }

  const cachedLoc = await AsyncStorage.getItem(STORAGE_CITY_DISPLAY_LOC);
  if (cachedLoc) return cachedLoc;

  return "your area";
}
