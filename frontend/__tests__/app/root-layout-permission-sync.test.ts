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
jest.mock("@/context/QuranAudioProvider", () => ({ QuranAudioProvider: ({ children }: any) => children }));
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
jest.mock("@/components/UpdateModal", () => "UpdateModal");
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

import { runInitialAppSync } from "@/app/_layout";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function deferred(): Deferred {
  let resolve = () => {};
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("Root layout initial sync ordering", () => {
  it("starts all sync/hydration tasks immediately and resolves only after all complete", async () => {
    const loc = deferred();
    const notif = deferred();
    const quran = deferred();
    const displayModes = deferred();
    const images = deferred();

    const deps = {
      syncLocationPermissionToSettings: jest.fn(() => loc.promise),
      syncNotificationPermissionToToggle: jest.fn(() => notif.promise),
      preloadQuranData: jest.fn(() => quran.promise),
      preloadQuranDisplayModes: jest.fn(() => displayModes.promise),
      preloadImages: jest.fn(() => images.promise),
    };

    let finished = false;
    const runPromise = runInitialAppSync(deps).then(() => {
      finished = true;
    });

    expect(deps.syncLocationPermissionToSettings).toHaveBeenCalledTimes(1);
    expect(deps.syncNotificationPermissionToToggle).toHaveBeenCalledTimes(1);
    expect(deps.preloadQuranData).toHaveBeenCalledTimes(1);
    expect(deps.preloadQuranDisplayModes).toHaveBeenCalledTimes(1);
    expect(deps.preloadImages).toHaveBeenCalledTimes(1);

    loc.resolve();
    notif.resolve();
    quran.resolve();
    displayModes.resolve();
    await Promise.resolve();
    expect(finished).toBe(false);

    images.resolve();
    await runPromise;
    expect(finished).toBe(true);
  });
});
