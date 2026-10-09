import * as Location from "expo-location";

import type { PrayerLocationOverride, PrayerSettings, ResolvedEnv } from "./types";

function coordBucket(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

/**
 * The coordinates behind the most recent prayer-times resolution.
 *
 * Every prayer-times fetch already resolves a real lat/lng, whether it came
 * from the device, a manual city, or an override. Recording it here lets the
 * dial draw the sun for that place without a second resolution, and without
 * any screen having to trigger a location permission prompt of its own.
 */
let lastResolved: { latitude: number; longitude: number } | null = null;

export function getLastResolvedCoords(): { latitude: number; longitude: number } | null {
  return lastResolved;
}

function remember(env: ResolvedEnv): ResolvedEnv {
  lastResolved = { latitude: env.latitude, longitude: env.longitude };
  return env;
}

// A fresh fix can fail even with permission granted (iOS reports "denied" when the
// app is launched in the background, or no fix is available yet). The last known
// position is good enough for prayer times; the caller falls back to the saved
// city after that.
async function currentCoords(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return loc.coords;
  } catch {
    try {
      return (await Location.getLastKnownPositionAsync())?.coords ?? null;
    } catch {
      return null;
    }
  }
}

export async function resolveCoordsAndCountry(
  settings: PrayerSettings,
  override?: PrayerLocationOverride,
): Promise<ResolvedEnv> {
  if (override?.coords) {
    const { latitude, longitude } = override.coords;
    const bucket = coordBucket(latitude, longitude);
    return remember({
      latitude,
      longitude,
      bucket,
      country: override.country ?? "",
    });
  }

  if (!settings.useLocation) {
    if (!settings.city) {
      throw new Error("City must be provided when location is disabled");
    }

    const { lat, lng, country } = settings.city;
    return remember({
      latitude: lat,
      longitude: lng,
      country: country || "",
      bucket: coordBucket(lat, lng),
    });
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
    const coords = await currentCoords();
    if (coords) {
      let country = "";
      try {
        const geo = await Location.reverseGeocodeAsync(coords);
        if (geo.length > 0) {
          country =
            (geo[0].country as string) || (geo[0].isoCountryCode as string) || "";
        }
      } catch {
        // no-op
      }

      return remember({
        latitude: coords.latitude,
        longitude: coords.longitude,
        country,
        bucket: coordBucket(coords.latitude, coords.longitude),
      });
    }
  }

  if (settings.city) {
    const { lat, lng, country } = settings.city;
    return remember({
      latitude: lat,
      longitude: lng,
      country: country || "",
      bucket: coordBucket(lat, lng),
    });
  }

  throw new Error(
    "Location unavailable. Enable Location Services or set a manual city in Settings.",
  );
}
