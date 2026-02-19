import { useCallback, useEffect, useMemo, useState } from "react";
import { DeviceEventEmitter } from "react-native";

import {
  DEFAULT_QURAN_DISPLAY_MODES,
  QURAN_DISPLAY_MODES_UPDATED_EVENT,
  QuranDisplayMode,
  getCachedQuranDisplayModes,
  getQuranDisplayModes,
  saveQuranDisplayModes,
  toggleQuranDisplayMode,
} from "@/services/quranDisplayModes";

export function useQuranDisplayModes() {
  const [displayModes, setDisplayModes] = useState<QuranDisplayMode[]>(() => {
    const cached = getCachedQuranDisplayModes();
    return cached.length > 0 ? cached : [...DEFAULT_QURAN_DISPLAY_MODES];
  });
  const [displayModesLoaded, setDisplayModesLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    getQuranDisplayModes()
      .then((modes) => {
        if (!mounted) {
          return;
        }
        setDisplayModes(modes);
      })
      .finally(() => {
        if (mounted) {
          setDisplayModesLoaded(true);
        }
      });

    const subscription = DeviceEventEmitter.addListener(
      QURAN_DISPLAY_MODES_UPDATED_EVENT,
      (nextModes: unknown) => {
        if (!mounted || !Array.isArray(nextModes)) {
          return;
        }
        setDisplayModes(nextModes as QuranDisplayMode[]);
      }
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const persistDisplayModes = useCallback(
    async (modes: readonly QuranDisplayMode[]) => {
      const next = await saveQuranDisplayModes(modes);
      setDisplayModes(next);
      return next;
    },
    []
  );

  const toggleDisplayMode = useCallback(async (mode: QuranDisplayMode) => {
    const next = await toggleQuranDisplayMode(mode);
    setDisplayModes(next);
    return next;
  }, []);

  const displayModeSet = useMemo(() => new Set(displayModes), [displayModes]);

  const isModeEnabled = useCallback(
    (mode: QuranDisplayMode) => displayModeSet.has(mode),
    [displayModeSet]
  );

  return {
    displayModes,
    displayModesLoaded,
    isModeEnabled,
    persistDisplayModes,
    toggleDisplayMode,
  };
}
