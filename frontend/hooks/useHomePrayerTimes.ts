import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, DeviceEventEmitter } from "react-native";
import { dateKeyFromDate } from "../services/holidayService";
import { getPrayerTimesToday, PrayerSettings, PrayerTime } from "../services/prayerTimes";
import CITIES, { City, cityKey } from "../utils/cities";
import { useNextPrayer } from "./useNextPrayer";

const DEFAULT_METHOD = 2;
const DEFAULT_CITY: City = CITIES[0];

function parseTimeToDate(timeStr: string, baseDate: Date): Date {
  const [time, modifier] = timeStr.split(" ");
  const [hoursStr, minutesStr] = time.split(":");
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

async function readSettings(): Promise<PrayerSettings> {
  const raw = await AsyncStorage.getItem("prayerSettings");
  if (!raw) {
    return { useLocation: true, method: DEFAULT_METHOD, city: DEFAULT_CITY };
  }

  const base = JSON.parse(raw) as PrayerSettings & { cityKey?: string };
  let city: City | undefined = base.city;
  if (!city && base.cityKey) {
    city = CITIES.find((c) => cityKey(c) === base.cityKey) ?? DEFAULT_CITY;
  }

  return {
    useLocation: base.useLocation ?? true,
    method: base.method ?? DEFAULT_METHOD,
    city: city ?? DEFAULT_CITY,
  };
}

async function writeSettings(settings: PrayerSettings) {
  const save = {
    useLocation: settings.useLocation,
    method: settings.method,
    cityKey: settings.city ? cityKey(settings.city) : undefined,
    city: settings.city,
  };

  await AsyncStorage.setItem("prayerSettings", JSON.stringify(save));
  if (!settings.useLocation && settings.city) {
    await AsyncStorage.setItem("selectedCity", cityKey(settings.city));
  }

  try {
    DeviceEventEmitter?.emit?.("settingsChanged", save);
  } catch {
    // ignore emit errors
  }
}

async function osAllowsLocation(): Promise<boolean> {
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  const perm = await Location.getForegroundPermissionsAsync();
  return servicesEnabled && perm.status === "granted";
}

async function readSyncedSettings(): Promise<PrayerSettings> {
  let settings = await readSettings();
  if (settings.useLocation) {
    const canUse = await osAllowsLocation();
    if (!canUse) {
      settings = {
        ...settings,
        useLocation: false,
        city: settings.city ?? DEFAULT_CITY,
      };
      await writeSettings(settings);
    }
  }
  return settings;
}

async function resolveCoordsAndLabel(effective: PrayerSettings): Promise<{
  coords?: { latitude: number; longitude: number };
  country?: string;
  label: string;
}> {
  if (!effective.useLocation) {
    return {
      coords: undefined,
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
      coords: undefined,
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
    const city =
      place?.city ||
      place?.district ||
      place?.subregion ||
      place?.region ||
      "Your area";
    const cc = place?.isoCountryCode || place?.country || "";
    label = `${city}${cc ? ", " + cc : ""}`;
    country = place?.country || place?.isoCountryCode || undefined;
  } catch {
    const lat = pos.coords.latitude.toFixed(3);
    const lon = pos.coords.longitude.toFixed(3);
    label = `Lat ${lat}, Lon ${lon}`;
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
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const prayerTimesRef = useRef(prayerTimes);
  useEffect(() => { prayerTimesRef.current = prayerTimes; }, [prayerTimes]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [prayerTimesDateKey, setPrayerTimesDateKey] = useState<string | null>(
    null,
  );
  const [nextDayFajr, setNextDayFajr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const { nextPrayer, timeLeft } = useNextPrayer(
    selectedDate,
    prayerTimes,
    prayerTimesDateKey,
  );

  const loadData = useCallback(async (reset = false) => {
    try {
      if (reset || prayerTimesRef.current.length === 0) {
        setLoading(true);
      }
      if (reset) {
        setPrayerTimes([]);
        setSelectedDate(null);
        setPrayerTimesDateKey(null);
        setNextDayFajr(null);
      }
      setBanner("");

      const effective = await readSyncedSettings();
      const { coords, country, label } = await resolveCoordsAndLabel(effective);
      setLocationLabel(label);

      const resolvedDate = new Date();
      const times = await getPrayerTimesToday(effective, { coords, country });
      setPrayerTimes(times);
      setSelectedDate(resolvedDate);
      setPrayerTimesDateKey(dateKeyFromDate(resolvedDate));

      const now = new Date();
      const hasUpcoming = times
        .map((pt) => parseTimeToDate(pt.time, resolvedDate))
        .some((dateObj) => dateObj > now);

      if (!hasUpcoming) {
        const tomorrowTimes = await getPrayerTimesToday(effective, {
          coords,
          country,
        });
        const fajr = tomorrowTimes.find((p) => p.label === "Fajr");
        setNextDayFajr(fajr?.time ?? null);
      } else {
        setNextDayFajr(null);
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
    const sub = DeviceEventEmitter.addListener("settingsChanged", async () => {
      await loadData();
    });

    return () => sub.remove();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    prayerTimes,
    nextPrayer,
    nextDayFajr,
    timeLeft,
    loading,
    refreshing,
    banner,
    locationLabel,
    refresh,
  };
}
