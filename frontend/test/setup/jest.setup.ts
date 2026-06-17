require("react-native-gesture-handler/jestSetup");
import "@testing-library/jest-native/extend-expect";

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

// @gorhom/bottom-sheet renders as plain views/list in tests so screens that
// embed the sheet can be rendered and queried.
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View, FlatList } = require("react-native");
  const Passthrough = ({ children, ...props }: any) =>
    React.createElement(View, props, children);
  return {
    __esModule: true,
    default: React.forwardRef(({ children, ...props }: any, _ref: any) =>
      React.createElement(View, props, children),
    ),
    BottomSheetView: Passthrough,
    BottomSheetFlatList: ({ ListHeaderComponent, ...props }: any) =>
      React.createElement(
        View,
        null,
        ListHeaderComponent
          ? React.createElement(
              typeof ListHeaderComponent === "function"
                ? ListHeaderComponent
                : () => ListHeaderComponent,
            )
          : null,
        React.createElement(FlatList, props),
      ),
    useBottomSheet: () => ({
      snapToIndex: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(),
    }),
  };
});
