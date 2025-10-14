// services/dailyPrayerTimes.ts
import * as Location from "expo-location";
import { City } from "../util/cities";
import { resolveAutoMethod } from "../util/methodResolver";

export interface PrayerSettings {
  useLocation: boolean;
  method: number; // calculation method (-1 = Auto)
  city?: City;
}

export interface PrayerTime {
  label: string;
  time: string;
}

function formatTo12Hour(time24: string): string {
  const clean = time24.split(" ")[0]; // strip "+05:00" if present
  const [hoursStr, minutesStr] = clean.split(":");
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

/**
 * Fetch prayer times for today. If coords are provided, those are used
 * for both label and timing resolution. This avoids stale or mismatched reads.
 */
export async function getPrayerTimesToday(
  settings: PrayerSettings,
  opts?: {
    coords?: { latitude: number; longitude: number };
    country?: string; // country string to support auto-method when provided
  }
): Promise<PrayerTime[]> {
  let latitude: number;
  let longitude: number;
  let country: string = opts?.country ?? "";

  // If caller already resolved coords, use them. Otherwise, resolve here.
  if (opts?.coords) {
    latitude = opts.coords.latitude;
    longitude = opts.coords.longitude;
  } else if (settings.useLocation) {
    // Full safety net if called directly without coords
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    let perm = await Location.getForegroundPermissionsAsync();
    if (!servicesEnabled) {
      if (settings.city) {
        latitude = settings.city.lat;
        longitude = settings.city.lng;
      } else {
        throw new Error(
          "Location services are disabled. Enable Location Services or set a manual city in Settings."
        );
      }
    } else {
      if (perm.status !== "granted") {
        const requested = await Location.requestForegroundPermissionsAsync();
        perm = requested;
      }
      if (perm.status !== "granted") {
        if (settings.city) {
          latitude = settings.city.lat;
          longitude = settings.city.lng;
        } else {
          throw new Error(
            "Location permission not granted. Grant permission or set a manual city in Settings."
          );
        }
      } else {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;

        try {
          const geo = await Location.reverseGeocodeAsync(loc.coords);
          if (geo.length > 0 && (geo[0].country || geo[0].isoCountryCode)) {
            country = geo[0].country || geo[0].isoCountryCode || "";
          }
        } catch {
        }
      }
    }
  } else {
    if (!settings.city)
      throw new Error("City must be provided when location is disabled");
    latitude = settings.city.lat;
    longitude = settings.city.lng;
  }

  let method = settings.method;
  if (method === -1) method = resolveAutoMethod(country);

  const res = await fetch(
    `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=${method}`
  );
  const data = await res.json();

  if (!data?.data?.timings) throw new Error("Invalid response from API");

  const t = data.data.timings;
  return [
    { label: "Fajr", time: formatTo12Hour(t.Fajr) },
    { label: "Sunrise", time: formatTo12Hour(t.Sunrise) },
    { label: "Dhuhr", time: formatTo12Hour(t.Dhuhr) },
    { label: "Asr", time: formatTo12Hour(t.Asr) },
    { label: "Maghrib", time: formatTo12Hour(t.Maghrib) },
    { label: "Isha", time: formatTo12Hour(t.Isha) },
  ];
}
