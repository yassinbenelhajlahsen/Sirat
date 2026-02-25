type PermissionSetup = {
  ensureNotificationPermissions: () => Promise<boolean>;
  configureAndroidNotificationChannel: () => Promise<void>;
  mocks: {
    getPermissionsAsync: jest.Mock;
    requestPermissionsAsync: jest.Mock;
    setNotificationChannelAsync: jest.Mock;
  };
};

function loadPermissions(params: {
  isDevice?: boolean;
  platform?: "ios" | "android";
  permissions?: { granted?: boolean; iosStatus?: number };
  requestResult?: { granted?: boolean; iosStatus?: number };
}): PermissionSetup {
  jest.resetModules();

  const getPermissionsAsync = jest.fn(async () => ({
    granted: params.permissions?.granted ?? false,
    ios: { status: params.permissions?.iosStatus ?? 0 },
  }));

  const requestPermissionsAsync = jest.fn(async () => ({
    granted: params.requestResult?.granted ?? false,
    ios: { status: params.requestResult?.iosStatus ?? 0 },
  }));

  const setNotificationChannelAsync = jest.fn(async () => {});

  jest.doMock("expo-device", () => ({
    isDevice: params.isDevice ?? true,
  }));

  jest.doMock("react-native", () => ({
    Platform: {
      OS: params.platform ?? "ios",
    },
  }));

  jest.doMock("expo-notifications", () => ({
    getPermissionsAsync,
    requestPermissionsAsync,
    setNotificationChannelAsync,
    IosAuthorizationStatus: {
      PROVISIONAL: 3,
    },
    AndroidImportance: {
      HIGH: "high",
    },
    AndroidNotificationVisibility: {
      PUBLIC: "public",
    },
  }));

  const mod = require("@/services/notifications/permissions");

  return {
    ensureNotificationPermissions: mod.ensureNotificationPermissions,
    configureAndroidNotificationChannel: mod.configureAndroidNotificationChannel,
    mocks: { getPermissionsAsync, requestPermissionsAsync, setNotificationChannelAsync },
  };
}

describe("notifications/permissions", () => {
  it("short-circuits to true on non-device environments", async () => {
    const setup = loadPermissions({ isDevice: false });

    await expect(setup.ensureNotificationPermissions()).resolves.toBe(true);
    expect(setup.mocks.getPermissionsAsync).not.toHaveBeenCalled();
    expect(setup.mocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("returns true when already granted", async () => {
    const setup = loadPermissions({
      permissions: { granted: true },
    });

    await expect(setup.ensureNotificationPermissions()).resolves.toBe(true);
    expect(setup.mocks.getPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(setup.mocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("accepts iOS provisional permission without prompting", async () => {
    const setup = loadPermissions({
      permissions: { granted: false, iosStatus: 3 },
    });

    await expect(setup.ensureNotificationPermissions()).resolves.toBe(true);
    expect(setup.mocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("requests permissions and returns false when denied", async () => {
    const setup = loadPermissions({
      permissions: { granted: false, iosStatus: 0 },
      requestResult: { granted: false, iosStatus: 0 },
    });

    await expect(setup.ensureNotificationPermissions()).resolves.toBe(false);
    expect(setup.mocks.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it("configures android channel only on android", async () => {
    const android = loadPermissions({ platform: "android" });
    await android.configureAndroidNotificationChannel();
    expect(android.mocks.setNotificationChannelAsync).toHaveBeenCalledTimes(1);

    const ios = loadPermissions({ platform: "ios" });
    await ios.configureAndroidNotificationChannel();
    expect(ios.mocks.setNotificationChannelAsync).not.toHaveBeenCalled();
  });
});
