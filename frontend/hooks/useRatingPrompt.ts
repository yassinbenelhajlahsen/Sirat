import { useEffect } from "react";
import { AppState } from "react-native";

import { recordVisit } from "@/services/ratingPrompt";

/** Counts each visit (launch once `ready`, then every return to the foreground) toward the rating prompt. */
export function useRatingPrompt(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    void recordVisit();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void recordVisit();
    });
    return () => sub.remove();
  }, [ready]);
}
