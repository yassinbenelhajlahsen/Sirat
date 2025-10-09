// app/_layout.tsx
import { Slot } from "expo-router";
import * as ExpoSplash from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";

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

  // Render the dynamic splash until the app is ready
  const [showSplash, setShowSplash] = useState(true);

  // If you add more boot tasks, flip this when they are done
  const appReady = fontsLoaded;

  // Optional non-blocking init that should not delay first paint
  useEffect(() => {
    NotificationService.init();
  }, []);

  // Hide native splash only after our React splash has mounted
  const hasHiddenNative = useRef(false);
  const hideNativeSplash = useCallback(async () => {
    if (hasHiddenNative.current) return;
    hasHiddenNative.current = true;
    try {
      await ExpoSplash.hideAsync();
    } catch {}
  }, []);

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
