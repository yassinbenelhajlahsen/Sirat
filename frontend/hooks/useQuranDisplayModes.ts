import { useCallback, useMemo } from "react";

import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import {
  QuranDisplayMode,
  saveQuranDisplayModes,
  toggleQuranDisplayMode,
} from "@/services/quranDisplayModes";
import { quranDisplayModesSetting } from "@/services/syncedSettings";

export function useQuranDisplayModes() {
  const { value: displayModes, loaded: displayModesLoaded } = useSyncedSetting(
    quranDisplayModesSetting
  );

  const persistDisplayModes = saveQuranDisplayModes;
  const toggleDisplayMode = toggleQuranDisplayMode;

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
