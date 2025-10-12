import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import * as ExpoSplash from "expo-splash-screen";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { NotificationService } from "../services/notificationService";
import SplashScreen from "./components/SplashScreen";

// Keep the native launch screen up until we say to hide it
ExpoSplash.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "SFProDisplay-Bold": require("../assets/fonts/SF-Pro-Display-Bold.otf"),
    "SFProDisplay-Regular": require("../assets/fonts/SF-Pro-Display-Regular.otf"),
    "SFProDisplay-Semibold": require("../assets/fonts/SF-Pro-Display-Semibold.otf"),
    ...Ionicons.font,
  });

  const [showSplash, setShowSplash] = useState(true);

  // Initialize notification logic (non-blocking)
  useEffect(() => {
    NotificationService.init();
  }, []);

  // ✅ Check for OTA updates once on app start
  useEffect(() => {
    async function checkForOTAUpdate() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          console.log("New OTA update found. Fetching...");
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync(); // Reload to apply new JS bundle immediately
        } else {
          console.log("App is up to date.");
        }
      } catch (e) {
        console.log("Failed to check for OTA update:", e);
      }
    }
    checkForOTAUpdate();
  }, []);

  const hasHiddenNative = useRef(false);
  const hideNativeSplash = useCallback(async () => {
    if (hasHiddenNative.current) return;
    hasHiddenNative.current = true;
    try {
      await ExpoSplash.hideAsync();
    } catch {}
  }, []);

  const appReady = fontsLoaded;

  return (
    <SafeAreaProvider>
      {showSplash ? (
        <SplashScreen
          ready={appReady}
          onReadyToHideNative={hideNativeSplash}
          onFinished={() => setShowSplash(false)}
        />
      ) : (
        <Slot />
      )}
    </SafeAreaProvider>
  );
}
