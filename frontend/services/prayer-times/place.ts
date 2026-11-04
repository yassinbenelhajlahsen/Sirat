import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import { resolveCityDisplay } from "../notifications/cityResolver";
import { STORAGE_CITY_DISPLAY_LOC } from "../notifications/constants";
import type { PrayerSettings } from "./types";

/**
 * The chosen city's coordinates. Prayer times already resolve through these
 * when device location is unavailable, and the dial needs them for the sun.
 */
function cityCoords(
  effective: PrayerSettings,
): { latitude: number; longitude: number } | undefined {
  const city = effective.city;
  if (!city || typeof city.lat !== "number" || typeof city.lng !== "number") return undefined;
  return { latitude: city.lat, longitude: city.lng };
}

export async function resolvePlace(effective: PrayerSettings): Promise<{
  coords?: { latitude: number; longitude: number };
  country?: string;
  label: string;
}> {
  if (!effective.useLocation) {
    return {
      coords: cityCoords(effective),
      label: effective.city?.name ?? "Unknown",
    };
  }

  let perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== "granted") {
    perm = await Location.requestForegroundPermissionsAsync();
  }

  const services = await Location.hasServicesEnabledAsync();
  if (!services || perm.status !== "granted") {
    return {
      coords: cityCoords(effective),
      label: effective.city?.name ?? "Location off",
    };
  }

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
    mayShowUserSettingsDialog: false,
  });

  let country: string | undefined;
  let label = "";
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const place = places?.[0];
    if (!place) throw new Error("no place");
    const city =
      place.city || place.district || place.subregion || place.region;
    if (!city) throw new Error("no city");
    const cc = place.isoCountryCode || place.country || "";
    label = `${city}${cc ? ", " + cc : ""}`;
    country = place.country || place.isoCountryCode || undefined;
    await AsyncStorage.setItem(STORAGE_CITY_DISPLAY_LOC, label);
  } catch {
    // Reverse geocode is network-backed and rate-limited; on failure fall
    // back to the shared resolver (last-known position, cached city, then
    // "your area") instead of ever surfacing raw coordinates.
    label = await resolveCityDisplay(effective, pos.coords);
  }

  return {
    coords: {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    },
    country,
    label,
  };
}
