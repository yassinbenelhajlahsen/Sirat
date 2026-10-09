import { useEffect } from "react";
import { AppState, DeviceEventEmitter } from "react-native";

import { THEME_CHANGED_EVENT } from "@/constants/theme";
import { syncWidgets } from "@/services/widgets/sync";

/** Keeps the home screen and lock screen widgets in step with the app. */
export function useWidgetSync(): void {
  useEffect(() => {
    void syncWidgets();
    const run = () => void syncWidgets();
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") run();
    });
    // City or method changes, and theme changes.
    const settings = DeviceEventEmitter.addListener("settingsChanged", run);
    const theme = DeviceEventEmitter.addListener(THEME_CHANGED_EVENT, run);
    return () => {
      appState.remove();
      settings.remove();
      theme.remove();
    };
  }, []);
}
