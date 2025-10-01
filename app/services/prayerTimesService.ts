import * as Location from "expo-location";
import { City } from "../util/cities";
import { resolveAutoMethod } from "../util/methodResolver";

export interface PrayerTime {
  label: string;
  time: string;
}

export interface PrayerSettings {
  useLocation: boolean;
  method: number; // calculation method (-1 = Auto)
  city?: City; // required if useLocation = false
}

// cache object
let cachedDate: string | null = null;
let cachedSettings: PrayerSettings | null = null;
let cachedTimes: PrayerTime[] | null = null;

function formatTo12Hour(time24: string): string {
  const [hoursStr, minutesStr] = time24.split(":");
  let hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12; // convert 0 → 12
  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

export async function getPrayerTimes(
  settings: PrayerSettings
): Promise<PrayerTime[]> {
  const todayStr = new Date().toDateString();

  // If cached and still valid, return cache
  if (
    cachedTimes &&
    cachedDate === todayStr &&
    cachedSettings &&
    JSON.stringify(cachedSettings) === JSON.stringify(settings)
  ) {
    return cachedTimes;
  }

  let latitude: number;
  let longitude: number;
  let country: string = "";

  if (settings.useLocation) {
    // Ask for location permission
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Location permission not granted");
    }

    const loc = await Location.getCurrentPositionAsync({});
    latitude = loc.coords.latitude;
    longitude = loc.coords.longitude;

    // reverse geocode to get country
    const geo = await Location.reverseGeocodeAsync(loc.coords);
    if (geo.length > 0 && geo[0].country) {
      country = geo[0].country;
    }
  } else {
    if (!settings.city) {
      throw new Error("City must be provided when location is disabled");
    }
    latitude = settings.city.lat;
    longitude = settings.city.lng;
    country = settings.city.country ?? "";
  }

  // --- NEW: resolve Auto method ---
  let method = settings.method;
  if (method === -1) {
    method = resolveAutoMethod(country);
  }

  // Fetch prayer times
  const res = await fetch(
    `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=${method}`
  );
  const data = await res.json();

  if (!data?.data?.timings) {
    throw new Error("Invalid response from prayer times API");
  }

  const timings = data.data.timings;

  const formatted: PrayerTime[] = [
    { label: "Fajr", time: formatTo12Hour(timings.Fajr) },
    { label: "Sunrise", time: formatTo12Hour(timings.Sunrise) },
    { label: "Dhuhr", time: formatTo12Hour(timings.Dhuhr) },
    { label: "Asr", time: formatTo12Hour(timings.Asr) },
    { label: "Maghrib", time: formatTo12Hour(timings.Maghrib) },
    { label: "Isha", time: formatTo12Hour(timings.Isha) },
  ];

  // Save cache
  cachedDate = todayStr;
  cachedSettings = settings;
  cachedTimes = formatted;

  return formatted;
}

export function clearPrayerCache() {
  cachedDate = null;
  cachedSettings = null;
  cachedTimes = null;
}
