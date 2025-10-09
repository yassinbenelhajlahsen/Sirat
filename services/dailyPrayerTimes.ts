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
  const clean = time24.split(" ")[0]; // strip "+05:00"
  const [hoursStr, minutesStr] = clean.split(":");
  let hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}
export async function getPrayerTimesToday(
  settings: PrayerSettings
): Promise<PrayerTime[]> {
  let latitude: number;
  let longitude: number;
  let country: string = "";

  if (settings.useLocation) {
    // If device location services are off, fall back to manual city if provided.
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
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
        // Request/verify permission; if denied, fall back to manual city when available.
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          const requested = await Location.requestForegroundPermissionsAsync();
          status = requested.status;
        }

        if (status !== "granted") {
          if (settings.city) {
            latitude = settings.city.lat;
            longitude = settings.city.lng;
          } else {
            throw new Error(
              "Location permission not granted. Grant permission or set a manual city in Settings."
            );
          }
        } else {
          // Permission granted — attempt to read location, but handle failures gracefully.
          try {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            latitude = loc.coords.latitude;
            longitude = loc.coords.longitude;

            const geo = await Location.reverseGeocodeAsync(loc.coords);
            if (geo.length > 0 && geo[0].country) country = geo[0].country;
          } catch (err) {
            // If retrieving position fails, fallback to manual city if available.
            console.warn("getCurrentPositionAsync failed:", err);
            if (settings.city) {
              latitude = settings.city.lat;
              longitude = settings.city.lng;
            } else {
              throw new Error(
                "Unable to obtain current location. Please try again or set a manual city in Settings."
              );
            }
          }
        }
      }
    } catch (err) {
      // Bubble up a clear error message
      if (err instanceof Error) throw err;
      throw new Error("Location unavailable and no manual city configured.");
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
