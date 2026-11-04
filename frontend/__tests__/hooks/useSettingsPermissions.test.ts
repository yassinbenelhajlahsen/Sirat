import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

jest.mock("@expo/vector-icons", () => ({ Ionicons: { font: {} } }));
jest.mock("expo-asset", () => ({ Asset: { loadAsync: jest.fn(async () => {}) } }));
jest.mock("expo-constants", () => ({ appOwnership: "expo" }));
jest.mock("expo-font", () => ({ useFonts: jest.fn(() => [true]) }));
jest.mock("expo-router", () => ({ Stack: { Screen: () => null } }));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(async () => {}),
  hideAsync: jest.fn(async () => {}),
}));
jest.mock("expo-system-ui", () => ({ setBackgroundColorAsync: jest.fn(async () => {}) }));
jest.mock("expo-updates", () => ({
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => {}),
  reloadAsync: jest.fn(async () => {}),
}));
jest.mock("@gorhom/portal", () => ({ PortalProvider: ({ children }: any) => children }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: ({ children }: any) => children }));
jest.mock("@/context/QuranAudioProvider", () => ({
  QuranAudioProvider: ({ children }: any) => children,
  useQuranAudioController: () => ({ isPlaying: false }),
}));
jest.mock("@/context/ThemeContext", () => ({
  ThemeProvider: ({ children }: any) => children,
  useTheme: () => ({
    theme: { colors: { primaryDark: "#000" } },
    isHydrated: true,
  }),
}));
jest.mock("@/services/quranData", () => ({ preloadQuranData: jest.fn(async () => {}) }));
jest.mock("@/services/quranDisplayModes", () => ({ preloadQuranDisplayModes: jest.fn(async () => {}) }));
jest.mock("@/components/SplashScreen", () => "SplashScreen");
jest.mock("@/components/quran/QuranMiniPlayerPortal", () => ({ QuranMiniPlayerPortal: () => null }));
jest.mock("@/services/notificationService", () => ({
  NotificationService: { init: jest.fn() },
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
}));

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  hasServicesEnabledAsync: jest.fn(async () => true),
}));

import * as Location from "expo-location";
import { prayerSettingsSetting } from "@/services/syncedSettings";
import {
  PRAYER_SETTINGS_KEY,
  syncLocationPermissionToSettings,
} from "@/app/_layout";

const mockLocation = Location as jest.Mocked<typeof Location>;

describe("useSettingsPermissions Phase 4", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("maps granted OS location permission to prayerSettings.useLocation=true and notifies subscribers", async () => {
    await AsyncStorage.setItem(
      PRAYER_SETTINGS_KEY,
      JSON.stringify({ method: 2, city: { name: "Chicago" }, useLocation: false }),
    );

    mockLocation.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "granted" } as any);
    mockLocation.hasServicesEnabledAsync.mockResolvedValueOnce(true as any);

    const changed = jest.fn();
    prayerSettingsSetting.subscribe(changed);

    await syncLocationPermissionToSettings();

    const stored = JSON.parse((await AsyncStorage.getItem(PRAYER_SETTINGS_KEY)) || "{}");
    expect(stored.useLocation).toBe(true);
    expect(stored.method).toBe(2);
    expect(stored.city).toEqual({ name: "Chicago" });
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ useLocation: true }), "local");
  });

  it("requests location permission when status is undecided and stores false when denied", async () => {
    mockLocation.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "undetermined" } as any);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied" } as any);
    mockLocation.hasServicesEnabledAsync.mockResolvedValueOnce(true as any);

    const changed = jest.fn();
    prayerSettingsSetting.subscribe(changed);

    await syncLocationPermissionToSettings();

    const stored = JSON.parse((await AsyncStorage.getItem(PRAYER_SETTINGS_KEY)) || "{}");
    expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(stored.useLocation).toBe(false);
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ useLocation: false }), "local");
  });
});
