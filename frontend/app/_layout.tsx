import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as ExpoSplash from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, DeviceEventEmitter, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

import { QuranAudioProvider } from "@/context/QuranAudioProvider";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { preloadQuranData } from "@/services/quranData";
import { preloadQuranDisplayModes } from "@/services/quranDisplayModes";
import { PortalProvider } from "@gorhom/portal";
import { NotificationService } from "../services/notificationService";
import SplashScreen from "@/components/SplashScreen";
import UpdateModal from "@/components/UpdateModal";
import { QuranMiniPlayerPortal } from "@/components/quran/QuranMiniPlayerPortal";

// Keep the native launch screen up until we say to hide it
ExpoSplash.preventAutoHideAsync().catch(() => {});
const LAUNCH_BACKGROUND_COLOR = "#0E1117";
SystemUI.setBackgroundColorAsync(LAUNCH_BACKGROUND_COLOR).catch(() => {});

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
  const currentEnabled =
    rawEnabled === "1"
      ? true
      : rawEnabled === "0"
        ? false
        : parseJSON<boolean>(rawEnabled, false);

  let nextEnabled = currentEnabled;
  if (osGranted && !currentEnabled) nextEnabled = true;
  if (!osGranted && currentEnabled) nextEnabled = false;

  await AsyncStorage.setItem(NOTIF_ENABLED_KEY, nextEnabled ? "1" : "0");
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
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}

function RootLayoutContent() {
  const { theme, isHydrated } = useTheme();
  const backgroundColor = isHydrated
    ? theme.colors.primaryDark
    : LAUNCH_BACKGROUND_COLOR;

  const [fontsLoaded] = useFonts({
    "SFProDisplay-Bold": require("../assets/fonts/SF-Pro-Display-Bold.otf"),
    "SFProDisplay-Regular": require("../assets/fonts/SF-Pro-Display-Regular.otf"),
    "SFProDisplay-Semibold": require("../assets/fonts/SF-Pro-Display-Semibold.otf"),
    ...Ionicons.font,
  });

  const [showSplash, setShowSplash] = useState(true);
  const [initialSynced, setInitialSynced] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isRestartingUpdate, setIsRestartingUpdate] = useState(false);
  const [showReloadCover, setShowReloadCover] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const otaCheckInFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const checkAndPrepareOtaUpdate = useCallback(async () => {
    if (otaCheckInFlightRef.current || updateReady) return;
    otaCheckInFlightRef.current = true;

    try {
      // Skip OTA checks entirely in Expo Go.
      if (Constants.appOwnership === "expo") return;

      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) return;

      await Updates.fetchUpdateAsync();

      if (mountedRef.current) {
        setUpdateReady(true);
      }
    } catch (error) {
      console.error("OTA update check failed", error);
    } finally {
      otaCheckInFlightRef.current = false;
    }
  }, [updateReady]);

  const handleRestartForUpdate = useCallback(async () => {
    if (isRestartingUpdate) return;

    SystemUI.setBackgroundColorAsync(LAUNCH_BACKGROUND_COLOR).catch(() => {});
    setIsRestartingUpdate(true);
    setShowUpdateModal(false);
    setShowReloadCover(true);
    setShowSplash(true);

    // Give React time to paint the cover before reloading JS.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    try {
      // Right before reloading, re-check and fetch to avoid restarting into a stale OTA.
      if (Constants.appOwnership !== "expo") {
        const latestUpdate = await Updates.checkForUpdateAsync();
        if (latestUpdate.isAvailable) {
          await Updates.fetchUpdateAsync();
        }
      }

      await Updates.reloadAsync({
        reloadScreenOptions: {
          backgroundColor: theme.colors.primaryDark,
          fade: true,
        },
      });
    } catch (error) {
      console.error("Failed to reload for OTA update", error);
      if (mountedRef.current) {
        setIsRestartingUpdate(false);
        setShowReloadCover(false);
        setShowSplash(false);
        setShowUpdateModal(true);
      }
    }
  }, [isRestartingUpdate, theme.colors.primaryDark]);

  useEffect(() => {
    NotificationService.init();
  }, []);

  // Keep native root/system background aligned with app color to avoid white frames
  // during bridge restarts (for example, immediate OTA reloads).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(backgroundColor).catch(() => {});
  }, [backgroundColor]);

  // Clear old Adhan notifications when the app opens so the tray stays clean.
  useEffect(() => {
    Notifications.dismissAllNotificationsAsync().catch(() => {});
  }, []);

  // Track mount state for safe state updates from async flows.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // OTA update check - run in background and prompt when ready
  useEffect(() => {
    checkAndPrepareOtaUpdate();
  }, [checkAndPrepareOtaUpdate]);

  // Do the initial permission syncs on launch, and re-sync on foreground
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await Promise.all([
          syncLocationPermissionToSettings(),
          syncNotificationPermissionToToggle(),
          preloadQuranData(),
          preloadQuranDisplayModes(),
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
        try {
          await Promise.all([
            syncLocationPermissionToSettings(),
            syncNotificationPermissionToToggle(),
          ]);
        } catch (error) {
          console.error("Failed to re-sync permissions on foreground", error);
        }
        if (updateReady) {
          setShowUpdateModal(true);
          return;
        }
        await checkAndPrepareOtaUpdate();
      }
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [checkAndPrepareOtaUpdate, updateReady]);

  // Native splash control
  const hasHiddenNative = useRef(false);
  const hideNativeSplash = useCallback(async () => {
    if (hasHiddenNative.current) return;
    hasHiddenNative.current = true;
    try {
      await ExpoSplash.hideAsync();
    } catch {}
  }, []);

  const appReady = fontsLoaded && initialSynced && isHydrated;
  const splashReady = appReady;

  return (
    <SafeAreaProvider>
      <PortalProvider>
        {/* Always render app content so it mounts and loads data while splash is visible */}
        <QuranAudioProvider>
          <View style={{ flex: 1, backgroundColor }}>
            <Stack screenOptions={{ headerShown: false, animation: "none" }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="MosqueMap"
                options={{ animation: "fade", animationDuration: 300 }}
              />
            </Stack>
            <QuranMiniPlayerPortal />
          </View>
        </QuranAudioProvider>

        {/* Overlay splash on top; it fades out to reveal the already-rendered app */}
        {showSplash && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            pointerEvents={splashReady ? "none" : "auto"}
          >
            <SplashScreen
              ready={splashReady}
              fontsReady={fontsLoaded}
              onReadyToHideNative={hideNativeSplash}
              onFinished={() => setShowSplash(false)}
            />
          </View>
        )}

        {/* Opaque fallback used right before runtime OTA reload to prevent white-frame flashes */}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: LAUNCH_BACKGROUND_COLOR,
            opacity: showReloadCover ? 1 : 0,
          }}
          pointerEvents={showReloadCover ? "auto" : "none"}
        />

        <UpdateModal
          visible={showUpdateModal && updateReady}
          isRestarting={isRestartingUpdate}
          onLater={() => setShowUpdateModal(false)}
          onRestart={() => {
            void handleRestartForUpdate();
          }}
        />
      </PortalProvider>
    </SafeAreaProvider>
  );
}
