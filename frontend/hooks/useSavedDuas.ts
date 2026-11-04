import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  DUA_SAVED_UPDATED_EVENT,
  getSavedDuaIds,
  toggleSavedDua,
} from "@/services/duaSaved";

/** Saved dua ids (newest first), kept live across screens and sync. */
export function useSavedDuas() {
  const [ids, setIds] = useState<number[]>([]);

  useEffect(() => {
    let active = true;
    const load = () =>
      void getSavedDuaIds().then((next) => {
        if (active) setIds(next);
      });
    load();
    const sub = DeviceEventEmitter.addListener(DUA_SAVED_UPDATED_EVENT, load);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  const isSaved = useCallback((id: number) => ids.includes(id), [ids]);
  const toggle = useCallback((id: number) => toggleSavedDua(id), []);

  return { ids, isSaved, toggle };
}
