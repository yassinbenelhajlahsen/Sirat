import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  QURAN_TEXT_SCALE_UPDATED_EVENT,
  getCachedQuranTextScale,
  getQuranTextScale,
  saveQuranTextScale,
  sanitizeQuranTextScale,
  type QuranTextScale,
} from "@/services/quranTextScale";

export function useQuranTextScale() {
  const [textScale, setTextScaleState] = useState<QuranTextScale>(getCachedQuranTextScale);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    getQuranTextScale()
      .then((value) => {
        if (mounted) setTextScaleState(value);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    const sub = DeviceEventEmitter.addListener(QURAN_TEXT_SCALE_UPDATED_EVENT, (next: unknown) => {
      if (mounted) setTextScaleState(sanitizeQuranTextScale(next));
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const setTextScale = useCallback(async (value: QuranTextScale) => {
    const next = await saveQuranTextScale(value);
    setTextScaleState(next);
    return next;
  }, []);

  return { textScale, setTextScale, loaded };
}
