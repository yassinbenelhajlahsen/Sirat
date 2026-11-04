import { useCallback } from "react";

import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import { quranReciterSetting } from "@/services/syncedSettings";

export function useQuranReciter() {
  const { value: reciterId } = useSyncedSetting(quranReciterSetting);
  const setReciterId = useCallback((value: string) => quranReciterSetting.set(value), []);
  return { reciterId, setReciterId };
}
