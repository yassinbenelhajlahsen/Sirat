import "@testing-library/jest-native/extend-expect";

import AsyncStorageMock from "@react-native-async-storage/async-storage/jest/async-storage-mock";

declare global {
  // eslint-disable-next-line no-var
  var freezeTestTime: (isoDate: string | Date) => void;
  // eslint-disable-next-line no-var
  var resetTestTime: () => void;
}

jest.mock("@react-native-async-storage/async-storage", () => AsyncStorageMock);

jest.mock("expo-network", () => ({
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: "WIFI",
  })),
}));

const notificationsMock = {
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

jest.mock("expo-notifications", () => notificationsMock);

if (!(global as { fetch?: unknown }).fetch) {
  (global as { fetch: jest.Mock }).fetch = jest.fn();
}

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
  if (jest.isMockFunction(setTimeout)) {
    jest.useRealTimers();
  }
});
