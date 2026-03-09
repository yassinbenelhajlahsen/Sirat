import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Platform } from "react-native";
import { getAppVersion, getVersionHeaders } from "@/services/appVersion";

jest.mock("expo-updates", () => ({
  runtimeVersion: null,
}));

jest.mock("expo-constants", () => ({
  default: {
    appOwnership: "standalone",
    expoConfig: { version: "1.0.10" },
  },
}));

const mockUpdates = Updates as { runtimeVersion: string | null };
const mockConstants = Constants as any;

describe("appVersion", () => {
  beforeEach(() => {
    // Reset to known defaults before each test
    mockUpdates.runtimeVersion = null;
    mockConstants.appOwnership = "standalone";
    mockConstants.expoConfig = { version: "1.0.10" };
  });

  it("falls back to expoConfig.version when runtimeVersion is null", () => {
    mockUpdates.runtimeVersion = null;
    expect(getAppVersion()).toBe("1.0.10");
  });

  it("prefers runtimeVersion over expoConfig.version", () => {
    mockUpdates.runtimeVersion = "2.0.0";
    expect(getAppVersion()).toBe("2.0.0");
  });

  it("falls back to 0.0.0 when both runtimeVersion and expoConfig.version are missing", () => {
    mockUpdates.runtimeVersion = null;
    mockConstants.expoConfig = {};
    expect(getAppVersion()).toBe("0.0.0");
  });

  it("getVersionHeaders returns all three expected headers", () => {
    mockUpdates.runtimeVersion = "1.0.10";
    const headers = getVersionHeaders();
    expect(headers["x-sirat-app-version"]).toBe("1.0.10");
    expect(headers["x-sirat-platform"]).toBe(Platform.OS);
    expect(headers["x-sirat-app-ownership"]).toBe("standalone");
  });
});
