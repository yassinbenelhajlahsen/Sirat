import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useNextPrayer } from "@/hooks/useNextPrayer";
import { usePrayerLog } from "@/hooks/usePrayerLog";
import { isLocationUnavailable } from "@/services/prayer-times/errors";
import { resolvePlace } from "@/services/prayer-times/place";
import { maghribOf, nextSlot, slotAt, type PrayerDay } from "@/services/prayerDay";
import { getEffectivePrayerSettings } from "@/services/prayerSettings";
import { getPrayerTimesForDate, getPrayerTimesToday } from "@/services/prayerTimes";
import type { PrayerName } from "@/services/prayerTracker";
import { prayerSettingsSetting } from "@/services/syncedSettings";
import { dateKeyFromDate } from "@/utils/dateKey";
import { formatHijriDate, isFastingDay } from "@/utils/hijriDate";

export type PrayerDayError = { code: "LOCATION" | "GENERIC"; message: string };

const LOCATION_MESSAGE =
  "Location is off. Turn it on in Settings or choose a saved city, then try again.";
const GENERIC_MESSAGE =
  "We could not load prayer times right now. Please try again later or set a manual city in Settings.";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

function isTransient(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /Too many requests|Failed to fetch|Network request failed|NetworkError/i.test(msg);
}

type Place = { coords: { latitude: number; longitude: number } | null; label: string };

/**
 * Everything a screen needs for one prayer day: its times, the next prayer and countdown, the Hijri
 * date, the user's prayer marks and the log sheet, and a load error that retries before it shows.
 *
 * Pass a date for a day being browsed, or "today" for the live view (Home): that also resolves the
 * place (label and coordinates for the dial's sun), loads tomorrow's Fajr when it is needed, and
 * supports pull-to-refresh.
 */
export function usePrayerDay(source: Date | "today" | null) {
  const live = source === "today";
  const date = live ? null : source;
  // A held Date would reload every render if it changed identity; the day itself is the key.
  const dayKey = date ? dateKeyFromDate(date) : null;

  const [prayerDay, setPrayerDay] = useState<PrayerDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<PrayerDayError | null>(null);
  const [place, setPlace] = useState<Place>({ coords: null, label: "" });
  const [nextDayFajr, setNextDayFajr] = useState<Date | null>(null);
  // Only loaded when tomorrow is a fasting day: the Ramadan card needs it after Maghrib.
  const [tomorrowFajr, setTomorrowFajr] = useState<Date | null>(null);
  const [nonce, setNonce] = useState(0);

  const dayRef = useRef(prayerDay);
  useEffect(() => {
    dayRef.current = prayerDay;
  }, [prayerDay]);
  const retry = useRef<{ attempt: number; timer: ReturnType<typeof setTimeout> | null }>({
    attempt: 0,
    timer: null,
  });
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!live && !dayKey) return;
    let mounted = true;
    const state = retry.current;

    (async () => {
      if (!dayRef.current?.slots.length) setLoading(true);
      setError(null);
      try {
        const effective = await getEffectivePrayerSettings();
        let day: PrayerDay;
        if (live) {
          const here = await resolvePlace(effective);
          if (!mounted) return;
          setPlace({ coords: here.coords ?? null, label: here.label });
          day = await getPrayerTimesToday(effective, { coords: here.coords, country: here.country });
        } else {
          day = await getPrayerTimesForDate(effective, date!);
        }
        if (!mounted) return;

        if (live) {
          const hasUpcoming = nextSlot(day, new Date()) !== null;
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowFasting = isFastingDay(tomorrow);
          let fajr: Date | null = null;
          if (!hasUpcoming || tomorrowFasting) {
            try {
              fajr = slotAt(await getPrayerTimesForDate(effective, tomorrow), "Fajr");
            } catch (err) {
              // Only the dial's "next day" state treats this as fatal; the Ramadan card can do without.
              if (!hasUpcoming) throw err;
            }
          }
          if (!mounted) return;
          setNextDayFajr(hasUpcoming ? null : fajr);
          setTomorrowFajr(tomorrowFasting ? fajr : null);
        }

        state.attempt = 0;
        setPrayerDay(day);
        setLoading(false);
        setRefreshing(false);
      } catch (err) {
        if (!mounted) return;
        console.warn("Prayer times fetch error:", err);
        const location = isLocationUnavailable(err);
        if (!location && isTransient(err) && state.attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_MS * 2 ** state.attempt + Math.floor(Math.random() * 500);
          state.attempt += 1;
          state.timer = setTimeout(reload, delay);
          return;
        }
        state.attempt = 0;
        setPrayerDay(null);
        setNextDayFajr(null);
        setTomorrowFajr(null);
        setError(
          location
            ? { code: "LOCATION", message: LOCATION_MESSAGE }
            : { code: "GENERIC", message: GENERIC_MESSAGE },
        );
        setLoading(false);
        setRefreshing(false);
      }
    })();

    return () => {
      mounted = false;
      if (state.timer) clearTimeout(state.timer);
      state.timer = null;
    };
    // `date` is represented by `dayKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, dayKey, nonce, reload]);

  // A changed method or city (here or synced from another device) reloads the day.
  useEffect(() => prayerSettingsSetting.subscribe(reload), [reload]);

  // Coming back to the app: the day may have rolled over, or the location changed.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") reload();
    });
    return () => sub.remove();
  }, [reload]);

  const manualRetry = useCallback(() => {
    retry.current.attempt = 0;
    reload();
  }, [reload]);

  // Pull-to-refresh: starts over, and spins until the load settles.
  const refresh = useCallback(() => {
    setRefreshing(true);
    retry.current.attempt = 0;
    setPrayerDay(null);
    setNextDayFajr(null);
    setTomorrowFajr(null);
    reload();
  }, [reload]);

  const { nextPrayer, timeLeft } = useNextPrayer(prayerDay);

  const markKey = live ? dateKeyFromDate(new Date()) : (dayKey ?? "");
  const { statuses, setStatus, clearStatus } = usePrayerLog(markKey);
  const [sheet, setSheet] = useState<{ name: PrayerName; label: string } | null>(null);
  const logSheet = {
    visible: sheet !== null,
    prayerName: sheet?.name ?? null,
    prayerLabel: sheet?.label ?? "",
    currentStatus: sheet ? statuses[sheet.name] : undefined,
    onSelect: (status: Parameters<typeof setStatus>[1]) => {
      if (sheet) setStatus(sheet.name, status);
      setSheet(null);
    },
    onClear: () => {
      if (sheet) clearStatus(sheet.name);
      setSheet(null);
    },
    onClose: () => setSheet(null),
  };
  const openLogSheet = useCallback(
    (name: PrayerName, label: string) => setSheet({ name, label }),
    [],
  );

  const isToday = live || markKey === dateKeyFromDate(new Date());
  // Only today's date follows the clock (it turns at Maghrib); other days show their daytime date,
  // which is the one holidays are keyed to.
  const hijri = isToday
    ? formatHijriDate(new Date(), maghribOf(prayerDay))
    : date
      ? formatHijriDate(date)
      : "";

  return {
    prayerDay,
    loading,
    error,
    retry: manualRetry,
    nextPrayer,
    timeLeft,
    hijri,
    statuses,
    logSheet,
    openLogSheet,
    // Live view only
    refreshing,
    refresh,
    locationLabel: place.label,
    coords: place.coords,
    nextDayFajr,
    tomorrowFajr,
  };
}
