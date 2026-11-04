import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { getEffectivePrayerSettings } from "@/services/prayerSettings";
import { prayerSettingsSetting } from "@/services/syncedSettings";
import { resolveCityDisplay } from "../services/notifications/cityResolver";
import { STORAGE_CITY_DISPLAY_LOC } from "../services/notifications/constants";
import { nextSlot, slotAt, type PrayerDay } from "../services/prayerDay";
import { getPrayerTimesForDate, getPrayerTimesToday, PrayerSettings } from "../services/prayerTimes";
import { isFastingDay } from "../utils/hijriDate";
import { useNextPrayer } from "./useNextPrayer";

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

async function resolveCoordsAndLabel(effective: PrayerSettings): Promise<{
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

export function useHomePrayerTimes() {
  const [prayerDay, setPrayerDay] = useState<PrayerDay | null>(null);
  const prayerDayRef = useRef(prayerDay);
  useEffect(() => { prayerDayRef.current = prayerDay; }, [prayerDay]);
  const [nextDayFajr, setNextDayFajr] = useState<Date | null>(null);
  // Only loaded when tomorrow is a fasting day: the Ramadan card needs it after Maghrib.
  const [tomorrowFajr, setTomorrowFajr] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  // Surfaced so the dial can compute the sun's position for this place.
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const { nextPrayer, timeLeft } = useNextPrayer(prayerDay);

  const loadData = useCallback(async (reset = false) => {
    try {
      if (reset || !prayerDayRef.current?.slots.length) {
        setLoading(true);
      }
      if (reset) {
        setPrayerDay(null);
        setNextDayFajr(null);
        setTomorrowFajr(null);
      }
      setBanner("");

      const effective = await getEffectivePrayerSettings();
      const { coords, country, label } = await resolveCoordsAndLabel(effective);
      setLocationLabel(label);
      setCoords(coords ?? null);

      const resolvedDate = new Date();
      const today = await getPrayerTimesToday(effective, { coords, country });
      setPrayerDay(today);

      const hasUpcoming = nextSlot(today, new Date()) !== null;

      const tomorrow = new Date(resolvedDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowFasting = isFastingDay(tomorrow);

      if (!hasUpcoming || tomorrowFasting) {
        let fajr: Date | null = null;
        try {
          fajr = slotAt(await getPrayerTimesForDate(effective, tomorrow), "Fajr");
        } catch (err) {
          // Only the dial's "next day" state treats this as fatal; the Ramadan card can do without.
          if (!hasUpcoming) throw err;
        }
        setNextDayFajr(hasUpcoming ? null : fajr);
        setTomorrowFajr(tomorrowFasting ? fajr : null);
      } else {
        setNextDayFajr(null);
        setTomorrowFajr(null);
      }
    } catch (err) {
      console.error("Error fetching prayer times:", err);
      setBanner(
        "We could not load prayer times right now. Please try again later or set a manual city in Settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        await loadData();
      }
    });

    return () => sub.remove();
  }, [loadData]);

  useEffect(() => {
    return prayerSettingsSetting.subscribe(() => {
      void loadData();
    });
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    prayerDay,
    nextPrayer,
    nextDayFajr,
    tomorrowFajr,
    timeLeft,
    loading,
    refreshing,
    banner,
    locationLabel,
    coords,
    refresh,
  };
}
