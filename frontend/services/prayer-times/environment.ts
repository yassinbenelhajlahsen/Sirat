import * as Location from "expo-location";

import type { PrayerLocationOverride, PrayerSettings, ResolvedEnv } from "./types";

function coordBucket(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

export async function resolveCoordsAndCountry(
  settings: PrayerSettings,
  override?: PrayerLocationOverride,
): Promise<ResolvedEnv> {
  if (override?.coords) {
    const { latitude, longitude } = override.coords;
    const bucket = coordBucket(latitude, longitude);
    return {
      latitude,
      longitude,
      bucket,
      country: override.country ?? "",
    };
  }

  if (!settings.useLocation) {
    if (!settings.city) {
      throw new Error("City must be provided when location is disabled");
    }

    const { lat, lng, country } = settings.city;
    return {
      latitude: lat,
      longitude: lng,
      country: country || "",
      bucket: coordBucket(lat, lng),
    };
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  let perm = await Location.getForegroundPermissionsAsync();

  if (!servicesEnabled || perm.status !== "granted") {
    try {
      if (perm.status !== "granted") {
        perm = await Location.requestForegroundPermissionsAsync();
      }
    } catch {
      // no-op
    }
  }

  if (servicesEnabled && perm.status === "granted") {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    let country = "";
    try {
      const geo = await Location.reverseGeocodeAsync(loc.coords);
      if (geo.length > 0) {
        country =
          (geo[0].country as string) || (geo[0].isoCountryCode as string) || "";
      }
    } catch {
      // no-op
    }

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      country,
      bucket: coordBucket(loc.coords.latitude, loc.coords.longitude),
    };
  }

  if (settings.city) {
    const { lat, lng, country } = settings.city;
    return {
      latitude: lat,
      longitude: lng,
      country: country || "",
      bucket: coordBucket(lat, lng),
    };
  }

  throw new Error(
    "Location unavailable. Enable Location Services or set a manual city in Settings.",
  );
}
