import { useCallback } from "react";

import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import { toggleSavedDua } from "@/services/duaSaved";
import { duaSavedSetting } from "@/services/syncedSettings";

/** Saved dua ids (newest first), kept live across screens and sync. */
export function useSavedDuas() {
  const { value: ids } = useSyncedSetting(duaSavedSetting);
  const isSaved = useCallback((id: number) => ids.includes(id), [ids]);
  const toggle = useCallback((id: number) => toggleSavedDua(id), []);
  return { ids, isSaved, toggle };
}
