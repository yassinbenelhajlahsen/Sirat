import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import { readRamadanMode, writeRamadanMode } from "@/services/notifications/storage";
import {
  NOTIF_PREFS_UPDATED_EVENT,
  RAMADAN_MODE_CHANGED_EVENT,
} from "@/utils/notifications/constants";

/** Ramadan mode on/off (default on). Also follows changes synced in from another device. */
export function useRamadanMode() {
  const [ramadanMode, setRamadanModeState] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = () => {
      readRamadanMode()
        .then((v) => mounted && setRamadanModeState(v))
        .catch(() => {});
    };
    load();
    // Sync applies write storage and broadcast NOTIF_PREFS_UPDATED; the local setter emits our own event.
    const subs = [
      DeviceEventEmitter.addListener(NOTIF_PREFS_UPDATED_EVENT, load),
      DeviceEventEmitter.addListener(RAMADAN_MODE_CHANGED_EVENT, load),
    ];
    return () => {
      mounted = false;
      subs.forEach((s) => s.remove());
    };
  }, []);

  const setRamadanMode = useCallback(async (value: boolean) => {
    setRamadanModeState(value);
    await writeRamadanMode(value);
    DeviceEventEmitter.emit(RAMADAN_MODE_CHANGED_EVENT);
  }, []);

  return { ramadanMode, setRamadanMode };
}
