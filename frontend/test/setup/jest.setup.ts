require("react-native-gesture-handler/jestSetup");
import "@testing-library/jest-native/extend-expect";

// Jest's RN environment has no idle callbacks; the app uses them in place of InteractionManager.
(globalThis as any).requestIdleCallback = (cb: (d: any) => void) =>
  setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0);
(globalThis as any).cancelIdleCallback = (id: any) => clearTimeout(id);

// Prevent @clerk/expo from initialising its MessagePort (open handle) in tests.
// Test files that need specific Clerk behaviour override this with their own jest.mock factory.
jest.mock("@clerk/expo", () => ({
  ClerkProvider: ({ children }: { children: any }) => children,
  useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }),
  useUser: () => ({ user: null }),
  useSSO: () => ({ startSSOFlow: jest.fn() }),
  getClerkInstance: () => ({ session: null }),
}));
jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: {} }));

// The ExpoWidgets native module only exists in a device build.
jest.mock("expo-widgets", () => ({
  createWidget: () => ({ updateTimeline: jest.fn(), updateSnapshot: jest.fn(), reload: jest.fn() }),
}));

declare global {
  // eslint-disable-next-line no-var
  var freezeTestTime: (isoDate: string | Date) => void;
  // eslint-disable-next-line no-var
  var resetTestTime: () => void;
}

const mockAsyncStorage =
  require("@react-native-async-storage/async-storage/jest/async-storage-mock");

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: "WIFI",
  })),
}));

const mockNotifications = {
  getPermissionsAsync: jest.fn(async () => ({ status: "granted", ios: { status: 3 } })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted", ios: { status: 3 } })),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => "notif-id-1"),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { HIGH: "high" },
  AndroidNotificationPriority: { HIGH: "high" },
  AndroidNotificationVisibility: { PUBLIC: "public" },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
};

jest.mock("expo-notifications", () => mockNotifications);

jest.mock(
  "expo-glass-effect",
  () => {
    const React = require("react");
    const { View } = require("react-native");
    return {
      GlassView: ({ children, ...props }: any) =>
        React.createElement(View, props, children),
      GlassContainer: ({ children, ...props }: any) =>
        React.createElement(View, props, children),
      isGlassEffectAvailable: jest.fn(() => true),
      isGlassEffectAPIAvailable: jest.fn(() => true),
      isLiquidGlassAvailable: jest.fn(() => true),
    };
  },
  { virtual: true },
);

// expo-symbols has no JS-side renderer in tests; render the Ionicons fallback so
// icon assertions stay stable. The AppIcon suite overrides this to assert symbols.
jest.mock("expo-symbols", () => ({
  SymbolView: ({ fallback }: { fallback?: unknown }) => fallback ?? null,
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// react-native-svg renders as plain Views in tests (Aurora background, PrayerArc).
// Every named export (Svg/Path/Rect/Defs/RadialGradient/Stop/…) maps to the mock.
jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Mock = ({ children, ...props }: any) =>
    React.createElement(View, props, children);
  return new Proxy(
    { __esModule: true, default: Mock },
    { get: (target: any, prop: string) => target[prop] ?? Mock },
  );
});

(global as unknown as { fetch: jest.Mock }).fetch = jest.fn();

global.freezeTestTime = (isoDate: string | Date) => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(isoDate));
};

global.resetTestTime = () => {
  jest.useRealTimers();
};

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  if (
    typeof globalThis.setTimeout === "function" &&
    jest.isMockFunction(globalThis.setTimeout)
  ) {
    jest.useRealTimers();
  }
});

// Worklets 0.7+ no longer falls back to JS under Jest; use the bundled mocks.
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

// Native SwiftUI hosts only exist in a device build. Sheets render their
// children inline while presented, so screens stay queryable.
jest.mock("@expo/ui/swift-ui", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Passthrough = ({ children }: any) => React.createElement(View, null, children);
  return {
    Host: Passthrough,
    DatePicker: () => null,
    Group: Passthrough,
    RNHostView: Passthrough,
    BottomSheet: ({ isPresented, children }: any) =>
      isPresented ? React.createElement(View, null, children) : null,
    // Each tagged Text becomes a pressable radio so tests can drive the control.
    Text: ({ children, modifiers }: any) => {
      const { Text: RNText } = require("react-native");
      return React.createElement(RNText, { modifiers }, children);
    },
    Picker: ({ selection, onSelectionChange, children }: any) => {
      const { Pressable } = require("react-native");
      return React.createElement(
        View,
        null,
        React.Children.map(children, (child: any) => {
          const mods = child.props.modifiers ?? [];
          const value = mods.find((m: any) => "tag" in m)?.tag;
          const label = mods.find((m: any) => "accessibilityLabel" in m)?.accessibilityLabel;
          return React.createElement(
            Pressable,
            {
              accessibilityRole: "radio",
              accessibilityLabel: label ?? child.props.children,
              accessibilityState: { selected: value === selection },
              onPress: () => onSelectionChange(value),
            },
            child,
          );
        }),
      );
    },
  };
});
jest.mock("@expo/ui/swift-ui/modifiers", () => {
  const modifier = () => ({});
  return {
    tag: (tag: unknown) => ({ tag }),
    accessibilityLabel: (accessibilityLabel: string) => ({ accessibilityLabel }),
    pickerStyle: modifier,
    datePickerStyle: modifier,
    interactiveDismissDisabled: modifier,
    preferredColorScheme: modifier,
    presentationBackgroundInteraction: modifier,
    presentationDetents: modifier,
    presentationDragIndicator: modifier,
    presentationSizing: modifier,
  };
});

