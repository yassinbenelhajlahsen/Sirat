import { useCallback } from "react";
import * as Haptics from "expo-haptics";

export type HapticEvent = "selection" | "light" | "medium" | "success" | "error";

const noop = () => {};

export function useHaptics() {
  return useCallback((event: HapticEvent) => {
    try {
      switch (event) {
        case "selection": Haptics.selectionAsync().catch(noop); break;
        case "light": Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(noop); break;
        case "medium": Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(noop); break;
        case "success": Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(noop); break;
        case "error": Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(noop); break;
      }
    } catch {
      // Haptics are best-effort; never block the UI.
    }
  }, []);
}
