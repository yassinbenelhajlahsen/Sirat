import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import * as ExpoSplash from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import GlobalTransition from "./components/GlobalTransition";
import SplashScreen from "./components/SplashScreen";

// Keep native splash until ready
ExpoSplash.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "SFProDisplay-Bold": require("../assets/fonts/SF-Pro-Display-Bold.otf"),
    "SFProDisplay-Regular": require("../assets/fonts/SF-Pro-Display-Regular.otf"),
    "SFProDisplay-Semibold": require("../assets/fonts/SF-Pro-Display-Semibold.otf"),
    ...Ionicons.font,
  });

  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current; // start hidden (we'll fade in)

  // Wait for fonts to load, then trigger transition
  useEffect(() => {
    if (fontsLoaded) {
      setTimeout(() => {
        setAppReady(true);
      }, 1800); 
    }
  }, [fontsLoaded]);

  // Fade splash out when ready
  useEffect(() => {
    if (!appReady) return;

    (async () => {
      try {
        await ExpoSplash.hideAsync();
      } catch (e) {
      }
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowSplash(false);
      });
    })();
  }, [appReady]);

  return (
    <SafeAreaProvider>
      {/* Hadith splash overlay with fade-out */}
      {showSplash && (
        <Animated.View
          style={{
            position: "absolute",
            zIndex: 99,
            width: "100%",
            height: "100%",
            opacity: fadeAnim,
          }}
        >
          <SplashScreen />
        </Animated.View>
      )}

      {/* Main app layout */}
      <GlobalTransition>
        <Slot />
      </GlobalTransition>
    </SafeAreaProvider>
  );
}
