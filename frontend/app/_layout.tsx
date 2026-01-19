import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import * as ExpoSplash from "expo-splash-screen";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, DeviceEventEmitter, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

import { QuranAudioProvider } from "@/context/QuranAudioProvider";
import { preloadQuranData } from "@/services/quranData";
import { NotificationService } from "../services/notificationService";
import SplashScreen from "./components/SplashScreen";
import { QuranMiniPlayerPortal } from "./components/quran/QuranMiniPlayerPortal";

// Keep the native launch screen up until we say to hide it
ExpoSplash.preventAutoHideAsync().catch(() => {});

// Storage keys and events used elsewhere in your app
const PRAYER_SETTINGS_KEY = "prayerSettings";
const NOTIF_ENABLED_KEY = "notif_enabled_v1";
const NOTIF_OS_STATUS_KEY = "notif_os_status_v1";
const SETTINGS_CHANGED_EVENT = "settingsChanged";
const NOTIF_PREFS_UPDATED_EVENT = "NOTIF_PREFS_UPDATED";

async function preloadImages() {
  await Asset.loadAsync([
    require("../assets/images/qibla-compass-svgrepo-com.png"),
  ]);
}

// Safe JSON parse helper
function parseJSON<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function syncLocationPermissionToSettings() {
  // 1) Read current OS permission without prompting
  const { status: currentStatus } =
    await Location.getForegroundPermissionsAsync();
  let status = currentStatus;

  // 2) If undecided, request now (first launch behavior)
  if (status !== "granted" && status !== "denied") {
    const res = await Location.requestForegroundPermissionsAsync();
    status = res.status;
  }

  // 3) Some users disable Location Services globally
  const servicesEnabled = await Location.hasServicesEnabledAsync();
  const granted = status === "granted" && servicesEnabled;

  // 4) Persist to prayerSettings.useLocation so Home/Settings start in sync
  const existingRaw = await AsyncStorage.getItem(PRAYER_SETTINGS_KEY);
  const existing = parseJSON<{
    useLocation?: boolean;
    method?: number;
    city?: any;
    cityKey?: string;
  }>(existingRaw, {});
  const next = { ...existing, useLocation: granted };

  await AsyncStorage.setItem(PRAYER_SETTINGS_KEY, JSON.stringify(next));

  // 5) Broadcast so listeners refresh immediately
  try {
    DeviceEventEmitter.emit(SETTINGS_CHANGED_EVENT, next);
  } catch {}
}

async function syncNotificationPermissionToToggle() {
  // 1) Read OS state
  const perms = await Notifications.getPermissionsAsync();
  let status = perms.status;

  // 2) If undecided, request now
  if (status !== "granted" && status !== "denied") {
    const res = await Notifications.requestPermissionsAsync();
    status = res.status;
  }

  const osGranted = status === "granted";

  // 3) Mirror OS into your stored toggle so Settings UI stays truthful
  const rawEnabled = await AsyncStorage.getItem(NOTIF_ENABLED_KEY);
  const currentEnabled = parseJSON<boolean>(rawEnabled, false);

  let nextEnabled = currentEnabled;
  if (osGranted && !currentEnabled) nextEnabled = true;
  if (!osGranted && currentEnabled) nextEnabled = false;

  await AsyncStorage.setItem(NOTIF_ENABLED_KEY, JSON.stringify(nextEnabled));
  await AsyncStorage.setItem(NOTIF_OS_STATUS_KEY, JSON.stringify(status));

  // 4) Notify the app so any schedulers/UI update
  try {
    DeviceEventEmitter.emit(NOTIF_PREFS_UPDATED_EVENT, {
      enabled: nextEnabled,
      osStatus: status,
    });
  } catch {}
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "SFProDisplay-Bold": require("../assets/fonts/SF-Pro-Display-Bold.otf"),
    "SFProDisplay-Regular": require("../assets/fonts/SF-Pro-Display-Regular.otf"),
    "SFProDisplay-Semibold": require("../assets/fonts/SF-Pro-Display-Semibold.otf"),
    ...Ionicons.font,
  });

  const [showSplash, setShowSplash] = useState(true);
  const [initialSynced, setInitialSynced] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    NotificationService.init();
  }, []);

  // Clear old Adhan notifications when the app opens so the tray stays clean.
  useEffect(() => {
  Notifications.dismissAllNotificationsAsync().catch(() => {});
}, []);

  // OTA update check
  useEffect(() => {
    if (Constants.appOwnership === "expo") {
      return;
    }

    async function checkForOTAUpdate() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.error("OTA update check failed", error);
      }
    }

    checkForOTAUpdate();
  }, []);

  // Do the initial permission syncs on launch, and re-sync on foreground
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await Promise.all([
          syncLocationPermissionToSettings(),
          syncNotificationPermissionToToggle(),
          preloadQuranData(),
          preloadImages(),
        ]);
      } catch (error) {
        console.error("Failed to complete initial app sync", error);
      } finally {
        if (mounted) setInitialSynced(true);
      }
    })();

    const sub = AppState.addEventListener("change", async (state) => {
      const wasBgToActive =
        appStateRef.current.match(/inactive|background/) && state === "active";
      appStateRef.current = state;
      if (wasBgToActive) {
        await Promise.all([
          syncLocationPermissionToSettings(),
          syncNotificationPermissionToToggle(),
        ]);
      }
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Native splash control
  const hasHiddenNative = useRef(false);
  const hideNativeSplash = useCallback(async () => {
    if (hasHiddenNative.current) return;
    hasHiddenNative.current = true;
    try {
      await ExpoSplash.hideAsync();
    } catch {}
  }, []);

  const appReady = fontsLoaded && initialSynced;

  return (
    <SafeAreaProvider>
      {showSplash ? (
        <SplashScreen
          ready={appReady}
          fontsReady={fontsLoaded}
          onReadyToHideNative={hideNativeSplash}
          onFinished={() => setShowSplash(false)}
        />
      ) : (
        <QuranAudioProvider>
          <View style={{ flex: 1 }}>
            <Slot />
            <QuranMiniPlayerPortal />
          </View>
        </QuranAudioProvider>
      )}
    </SafeAreaProvider>
  );
}
