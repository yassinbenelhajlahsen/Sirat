import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  DEFAULT_PREFS,
  DEFAULT_WINDOW_OFFSET,
  DEFAULT_WINDOW_PREFS,
  NOTIF_PREFS_UPDATED_EVENT,
  PrayerKey,
  SOUND_OPTIONS,
  SoundMode,
  STORAGE_ENABLED,
  STORAGE_MAP,
  STORAGE_SOUND_MODE,
  STORAGE_WINDOW_MAP,
  STORAGE_WINDOW_OFFSET,
  WINDOW_OFFSET_OPTIONS,
  WINDOW_PRAYERS,
  WindowPrayerKey,
  WindowPrefMap,
} from "../utils/notifications/constants";

const SAFE_DEFAULT_SOUND: SoundMode = "default";

function parsePrefs(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    const next = { ...DEFAULT_PREFS } as Record<PrayerKey, boolean>;
    (Object.keys(parsed) as PrayerKey[]).forEach((key) => {
      if (key in next && typeof parsed[key] === "boolean") {
        next[key] = parsed[key];
      }
    });
    return next;
  } catch {
    return null;
  }
}

function parseSound(raw: string | null): SoundMode {
  return SOUND_OPTIONS.some((option) => option.id === raw)
    ? (raw as SoundMode)
    : SAFE_DEFAULT_SOUND;
}

function parseWindowPrefs(raw: string | null): WindowPrefMap {
  const next = { ...DEFAULT_WINDOW_PREFS };
  if (!raw) return next;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const key of WINDOW_PRAYERS) {
      if (typeof parsed[key] === "boolean") next[key] = parsed[key] as boolean;
    }
  } catch {
    // ignore malformed JSON
  }
  return next;
}

function parseWindowOffset(raw: string | null): number {
  const value = raw ? parseInt(raw, 10) : NaN;
  return (WINDOW_OFFSET_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_WINDOW_OFFSET;
}

function emitPreferences(payload: {
  enabled: boolean;
  prefs: Record<PrayerKey, boolean>;
  soundMode: SoundMode;
  windowPrefs: WindowPrefMap;
  windowOffset: number;
}) {
  try {
    DeviceEventEmitter.emit(NOTIF_PREFS_UPDATED_EVENT, payload);
  } catch {
    // ignore emit errors
  }
}

export function useNotificationPreferences({
  notifStatus,
}: {
  notifStatus?: string | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [prefs, setPrefs] = useState<Record<PrayerKey, boolean>>(() => ({
    ...DEFAULT_PREFS,
  }));
  const [soundMode, setSoundMode] = useState<SoundMode>(SAFE_DEFAULT_SOUND);

  const prefsRef = useRef<Record<PrayerKey, boolean>>({ ...DEFAULT_PREFS });
  const soundModeRef = useRef<SoundMode>(SAFE_DEFAULT_SOUND);

  const [windowPrefs, setWindowPrefs] = useState<WindowPrefMap>(() => ({
    ...DEFAULT_WINDOW_PREFS,
  }));
  const [windowOffset, setWindowOffsetState] = useState<number>(
    DEFAULT_WINDOW_OFFSET,
  );

  const windowPrefsRef = useRef<WindowPrefMap>({ ...DEFAULT_WINDOW_PREFS });
  const windowOffsetRef = useRef<number>(DEFAULT_WINDOW_OFFSET);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          STORAGE_MAP,
          STORAGE_ENABLED,
          STORAGE_SOUND_MODE,
          STORAGE_WINDOW_MAP,
          STORAGE_WINDOW_OFFSET,
        ]);
        if (!active) return;

        const rawMap = entries.find(([key]) => key === STORAGE_MAP)?.[1];
        const parsedPrefs = parsePrefs(rawMap ?? null);
        if (parsedPrefs) {
          prefsRef.current = parsedPrefs;
          setPrefs(parsedPrefs);
        }

        const rawEnabled = entries.find(
          ([key]) => key === STORAGE_ENABLED,
        )?.[1];
        if (rawEnabled === "1" || rawEnabled === "0") {
          setEnabled(rawEnabled === "1");
        }

        const rawSound = entries.find(
          ([key]) => key === STORAGE_SOUND_MODE,
        )?.[1];
        const nextSound = parseSound(rawSound ?? null);
        soundModeRef.current = nextSound;
        setSoundMode(nextSound);

        const rawWindowMap = entries.find(
          ([key]) => key === STORAGE_WINDOW_MAP,
        )?.[1];
        const nextWindowPrefs = parseWindowPrefs(rawWindowMap ?? null);
        windowPrefsRef.current = nextWindowPrefs;
        setWindowPrefs(nextWindowPrefs);

        const rawWindowOffset = entries.find(
          ([key]) => key === STORAGE_WINDOW_OFFSET,
        )?.[1];
        const nextWindowOffset = parseWindowOffset(rawWindowOffset ?? null);
        windowOffsetRef.current = nextWindowOffset;
        setWindowOffsetState(nextWindowOffset);
      } catch {
        // ignore hydration errors
      } finally {
        if (active) setLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (notifStatus == null) return;
    setEnabled(notifStatus === "granted");
  }, [notifStatus]);

  useEffect(() => {
    soundModeRef.current = soundMode;
  }, [soundMode]);

  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    windowPrefsRef.current = windowPrefs;
  }, [windowPrefs]);

  useEffect(() => {
    windowOffsetRef.current = windowOffset;
  }, [windowOffset]);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_ENABLED, enabled ? "1" : "0");
      } catch {
        // ignore persist errors
      }
    })();
    emitPreferences({
      enabled,
      prefs: prefsRef.current,
      soundMode: soundModeRef.current,
      windowPrefs: windowPrefsRef.current,
      windowOffset: windowOffsetRef.current,
    });
  }, [enabled, loaded]);

  const setPrayerPreference = useCallback(
    async (key: PrayerKey, value: boolean) => {
      const next = { ...prefsRef.current, [key]: value };
      prefsRef.current = next;
      setPrefs(next);
      try {
        await AsyncStorage.setItem(STORAGE_MAP, JSON.stringify(next));
      } catch {
        // ignore persist errors
      }
      emitPreferences({
        enabled,
        prefs: next,
        soundMode: soundModeRef.current,
        windowPrefs: windowPrefsRef.current,
        windowOffset: windowOffsetRef.current,
      });
    },
    [enabled],
  );

  const updateSoundMode = useCallback(
    async (nextMode: SoundMode) => {
      if (nextMode === soundModeRef.current) return;
      soundModeRef.current = nextMode;
      setSoundMode(nextMode);
      try {
        await AsyncStorage.setItem(STORAGE_SOUND_MODE, nextMode);
      } catch {
        // ignore persist errors
      }
      emitPreferences({
        enabled,
        prefs: prefsRef.current,
        soundMode: nextMode,
        windowPrefs: windowPrefsRef.current,
        windowOffset: windowOffsetRef.current,
      });
    },
    [enabled],
  );

  const setWindowPreference = useCallback(
    async (key: WindowPrayerKey, value: boolean) => {
      const next = { ...windowPrefsRef.current, [key]: value };
      windowPrefsRef.current = next;
      setWindowPrefs(next);
      try {
        await AsyncStorage.setItem(STORAGE_WINDOW_MAP, JSON.stringify(next));
      } catch {
        // ignore persist errors
      }
      emitPreferences({
        enabled,
        prefs: prefsRef.current,
        soundMode: soundModeRef.current,
        windowPrefs: next,
        windowOffset: windowOffsetRef.current,
      });
    },
    [enabled],
  );

  const setWindowOffset = useCallback(
    async (minutes: number) => {
      if (minutes === windowOffsetRef.current) return;
      windowOffsetRef.current = minutes;
      setWindowOffsetState(minutes);
      try {
        await AsyncStorage.setItem(STORAGE_WINDOW_OFFSET, String(minutes));
      } catch {
        // ignore persist errors
      }
      emitPreferences({
        enabled,
        prefs: prefsRef.current,
        soundMode: soundModeRef.current,
        windowPrefs: windowPrefsRef.current,
        windowOffset: minutes,
      });
    },
    [enabled],
  );

  return {
    loaded,
    enabled,
    prefs,
    soundMode,
    windowPrefs,
    windowOffset,
    setPrayerPreference,
    updateSoundMode,
    setWindowPreference,
    setWindowOffset,
  };
}
