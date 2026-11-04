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
  requestLocationPermissionIfUndecided,
} from "@/app/_layout";

const mockLocation = Location as jest.Mocked<typeof Location>;

describe("useSettingsPermissions Phase 4", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("never writes prayer settings, whatever the permission says", async () => {
    await AsyncStorage.setItem("prayerSettings", JSON.stringify({ method: 2, useLocation: true }));
    mockLocation.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied" } as any);

    const changed = jest.fn();
    const off = prayerSettingsSetting.subscribe(changed);

    await requestLocationPermissionIfUndecided();

    expect(mockLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(JSON.parse((await AsyncStorage.getItem("prayerSettings")) || "{}").useLocation).toBe(true);
    off();
  });

  it("asks once when the permission is undecided, and still writes nothing when it is denied", async () => {
    mockLocation.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "undetermined" } as any);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied" } as any);

    await requestLocationPermissionIfUndecided();

    expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem("prayerSettings")).toBeNull();
  });
});
