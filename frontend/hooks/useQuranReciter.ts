import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import { sanitizeQuranReciterId } from "@/services/quranAudio";
import {
  QURAN_RECITER_UPDATED_EVENT,
  getCachedQuranReciter,
  getQuranReciter,
  saveQuranReciter,
} from "@/services/quranReciter";

export function useQuranReciter() {
  const [reciterId, setReciterIdState] = useState<string>(getCachedQuranReciter);

  useEffect(() => {
    let mounted = true;
    getQuranReciter().then((value) => {
      if (mounted) setReciterIdState(value);
    });

    const sub = DeviceEventEmitter.addListener(QURAN_RECITER_UPDATED_EVENT, (next: unknown) => {
      if (mounted) setReciterIdState(sanitizeQuranReciterId(next));
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const setReciterId = useCallback(async (value: string) => {
    const next = await saveQuranReciter(value);
    setReciterIdState(next);
    return next;
  }, []);

  return { reciterId, setReciterId };
}
