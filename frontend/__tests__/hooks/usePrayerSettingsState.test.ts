import AsyncStorage from "@react-native-async-storage/async-storage";

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

jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  hasServicesEnabledAsync: jest.fn(async () => true),
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
}));

import * as Notifications from "expo-notifications";
import { subscribeMasterEnabled } from "@/services/notifications/storage";
import {
  NOTIF_ENABLED_KEY,
  NOTIF_OS_STATUS_KEY,
  syncNotificationPermissionToToggle,
} from "@/app/_layout";

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;

describe("usePrayerSettingsState Phase 4", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("maps granted OS notification permission to the enabled flag and announces the change", async () => {
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, "0");
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: "granted" } as any);

    const changes = jest.fn();
    subscribeMasterEnabled(changes);

    await syncNotificationPermissionToToggle();

    expect(await AsyncStorage.getItem(NOTIF_ENABLED_KEY)).toBe("1");
    expect(await AsyncStorage.getItem(NOTIF_OS_STATUS_KEY)).toBe('"granted"');
    expect(changes).toHaveBeenCalledWith(true);
  });

  it("requests permission when undecided and syncs disabled state when denied", async () => {
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, "1");
    mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: "undetermined" } as any);
    mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: "denied" } as any);

    const changes = jest.fn();
    subscribeMasterEnabled(changes);

    await syncNotificationPermissionToToggle();

    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(NOTIF_ENABLED_KEY)).toBe("0");
    expect(await AsyncStorage.getItem(NOTIF_OS_STATUS_KEY)).toBe('"denied"');
    expect(changes).toHaveBeenCalledWith(false);
  });
});
