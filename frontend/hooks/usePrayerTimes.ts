import { useCallback, useEffect, useRef, useState } from "react";
import { getEffectivePrayerSettings } from "../services/prayerSettings";
import type { PrayerDay } from "../services/prayerDay";
import { getPrayerTimesForDate } from "../services/prayerTimes";
import { prayerSettingsSetting } from "../services/syncedSettings";

export type PrayerTimesError =
  | { code: "PERMISSION"; message: string }
  | { code: "GENERIC"; message: string };

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

function isPermissionError(error: unknown): boolean {
  return /Location permission not granted/i.test(errorMessage(error));
}

function isTransientError(error: unknown): boolean {
  const msg = errorMessage(error);
  return (
    /Too many requests/i.test(msg) ||
    /Failed to fetch|Network request failed|NetworkError/i.test(msg)
  );
}

export function usePrayerTimes(selectedDate: Date | null) {
  const [prayerDay, setPrayerDay] = useState<PrayerDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PrayerTimesError | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);

  const prayerDayRef = useRef<PrayerDay | null>(null);
  const retryRef = useRef<{
    attempt: number;
    t: ReturnType<typeof setTimeout> | null;
  }>({
    attempt: 0,
    t: null,
  });

  useEffect(() => {
    prayerDayRef.current = prayerDay;
  }, [prayerDay]);

  const clearRetry = useCallback(() => {
    if (retryRef.current.t) clearTimeout(retryRef.current.t);
    retryRef.current.t = null;
  }, []);

  const resetRetry = useCallback(() => {
    clearRetry();
    retryRef.current.attempt = 0;
  }, [clearRetry]);

  const scheduleRetry = useCallback(() => {
    const base = 2000;
    const delay = Math.min(30000, base * Math.pow(2, retryRef.current.attempt));
    const jitter = Math.floor(Math.random() * 500);
    clearRetry();
    retryRef.current.t = setTimeout(() => {
      setFetchNonce((n) => n + 1);
    }, delay + jitter);
    retryRef.current.attempt += 1;
  }, [clearRetry]);

  useEffect(() => {
    if (!selectedDate) return;
    let mounted = true;

    (async () => {
      if (!prayerDayRef.current?.slots.length) {
        setLoading(true);
      }
      setError(null);

      try {
        const settings = await getEffectivePrayerSettings();
        const day = await getPrayerTimesForDate(settings, selectedDate);
        if (!mounted) return;

        resetRetry();
        setPrayerDay(day);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        console.warn("Prayer times fetch error:", err);

        if (isPermissionError(err)) {
          resetRetry();
          setError({
            code: "PERMISSION",
            message:
              "Location is off. Turn it on in Settings or choose a saved city, then try again.",
          });
          setPrayerDay(null);
          setLoading(false);
          return;
        }

        if (isTransientError(err)) {
          setError(null);
          setLoading(!prayerDayRef.current?.slots.length);
          scheduleRetry();
          return;
        }

        resetRetry();
        setError({
          code: "GENERIC",
          message: "Could not load prayer times. Please try again later.",
        });
        setPrayerDay(null);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      clearRetry();
    };
  }, [clearRetry, fetchNonce, resetRetry, scheduleRetry, selectedDate]);

  // A changed method or city (here or synced from another device) reloads the day.
  useEffect(
    () => prayerSettingsSetting.subscribe(() => setFetchNonce((n) => n + 1)),
    [],
  );

  const retry = useCallback(() => {
    resetRetry();
    setFetchNonce((n) => n + 1);
  }, [resetRetry]);

  return {
    prayerDay,
    loading,
    error,
    retry,
  };
}
