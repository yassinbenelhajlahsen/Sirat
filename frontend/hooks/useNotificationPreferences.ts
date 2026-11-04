import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import {
  notifFridaySetting,
  notifPrefsSetting,
  notifSoundModeSetting,
  notifWindowMapSetting,
  notifWindowOffsetSetting,
} from "@/services/syncedSettings";
import { writeMasterEnabled } from "@/services/notifications/storage";
import {
  PrayerKey,
  SoundMode,
  STORAGE_ENABLED,
  WindowPrayerKey,
} from "../utils/notifications/constants";

export function useNotificationPreferences({
  notifStatus,
}: {
  notifStatus?: string | null;
}) {
  const [enabledLoaded, setEnabledLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const { value: prefs, loaded: prefsLoaded } = useSyncedSetting(notifPrefsSetting);
  const { value: soundMode, loaded: soundLoaded } = useSyncedSetting(notifSoundModeSetting);
  const { value: windowPrefs, loaded: windowLoaded } = useSyncedSetting(notifWindowMapSetting);
  const { value: windowOffset, loaded: offsetLoaded } = useSyncedSetting(notifWindowOffsetSetting);
  const { value: fridayEnabled, loaded: fridayLoaded } = useSyncedSetting(notifFridaySetting);

  const loaded =
    enabledLoaded && prefsLoaded && soundLoaded && windowLoaded && offsetLoaded && fridayLoaded;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const rawEnabled = await AsyncStorage.getItem(STORAGE_ENABLED);
        if (active && (rawEnabled === "1" || rawEnabled === "0")) {
          setEnabled(rawEnabled === "1");
        }
      } catch {
        // ignore hydration errors
      } finally {
        if (active) setEnabledLoaded(true);
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

  // The master toggle is device-only, so it is not a synced setting; it has its own change signal.
  useEffect(() => {
    if (!enabledLoaded) return;
    writeMasterEnabled(enabled).catch(() => {
      // ignore persist errors
    });
  }, [enabled, enabledLoaded]);

  const setPrayerPreference = useCallback(
    async (key: PrayerKey, value: boolean) => {
      await notifPrefsSetting.set({ ...(await notifPrefsSetting.get()), [key]: value });
    },
    [],
  );

  const updateSoundMode = useCallback(async (nextMode: SoundMode) => {
    if (nextMode === notifSoundModeSetting.peek()) return;
    await notifSoundModeSetting.set(nextMode);
  }, []);

  const setWindowPreference = useCallback(
    async (key: WindowPrayerKey, value: boolean) => {
      await notifWindowMapSetting.set({ ...(await notifWindowMapSetting.get()), [key]: value });
    },
    [],
  );

  const setWindowOffset = useCallback(async (minutes: number) => {
    if (minutes === notifWindowOffsetSetting.peek()) return;
    await notifWindowOffsetSetting.set(minutes);
  }, []);

  const setFridayEnabled = useCallback(async (value: boolean) => {
    if (value === notifFridaySetting.peek()) return;
    await notifFridaySetting.set(value);
  }, []);

  return {
    loaded,
    enabled,
    prefs,
    soundMode,
    windowPrefs,
    windowOffset,
    fridayEnabled,
    setPrayerPreference,
    updateSoundMode,
    setWindowPreference,
    setWindowOffset,
    setFridayEnabled,
  };
}
