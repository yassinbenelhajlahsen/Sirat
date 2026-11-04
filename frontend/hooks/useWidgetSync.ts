import { useEffect } from "react";
import { AppState } from "react-native";

import { prayerSettingsSetting, themeSetting } from "@/services/syncedSettings";
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
    const unsubscribeSettings = prayerSettingsSetting.subscribe(run);
    const unsubscribeTheme = themeSetting.subscribe(run);
    return () => {
      appState.remove();
      unsubscribeSettings();
      unsubscribeTheme();
    };
  }, []);
}
