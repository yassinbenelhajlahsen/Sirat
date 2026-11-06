// The wrapper probes the native module via expo-modules-core's
// requireOptionalNativeModule. Mock just that boundary.
jest.mock("expo-modules-core", () => ({
  requireOptionalNativeModule: jest.fn(),
}));

import { requireOptionalNativeModule } from "expo-modules-core";

import { getDeviceToken, hasDeviceCheckModule } from "@/services/chat/deviceCheck";

const mockRequireOptional = requireOptionalNativeModule as jest.Mock;

const nativeMock = {
  isSupported: jest.fn(() => true),
  generateToken: jest.fn(async () => "dG9rZW4="),
};

describe("deviceCheck wrapper", () => {
  beforeEach(() => {
    nativeMock.isSupported.mockReturnValue(true);
    nativeMock.generateToken.mockResolvedValue("dG9rZW4=");
    mockRequireOptional.mockReturnValue(nativeMock);
  });

  it("reports the module missing when the native side is absent (Expo Go, Android)", () => {
    mockRequireOptional.mockReturnValue(null);
    expect(hasDeviceCheckModule()).toBe(false);
  });

  it("resolves a null token when the native module is absent", async () => {
    mockRequireOptional.mockReturnValue(null);
    await expect(getDeviceToken()).resolves.toBeNull();
  });

  it("resolves a null token when generation rejects", async () => {
    nativeMock.generateToken.mockRejectedValue(new Error("DCErrorInvalidInput"));
    await expect(getDeviceToken()).resolves.toBeNull();
  });

  it("resolves a null token without asking for one on unsupported devices", async () => {
    nativeMock.isSupported.mockReturnValue(false);
    await expect(getDeviceToken()).resolves.toBeNull();
    expect(nativeMock.generateToken).not.toHaveBeenCalled();
  });

  it("resolves the token from the native module", async () => {
    expect(hasDeviceCheckModule()).toBe(true);
    await expect(getDeviceToken()).resolves.toBe("dG9rZW4=");
  });
});
