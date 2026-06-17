// The service probes the native module via expo-modules-core's
// requireOptionalNativeModule. Mock just that boundary.
jest.mock("expo-modules-core", () => ({
  requireOptionalNativeModule: jest.fn(),
}));

import { requireOptionalNativeModule } from "expo-modules-core";

import {
  alternateIconsSupported,
  applyIconForTheme,
  getActiveIconName,
  iconMatchesTheme,
  iconNameForTheme,
} from "@/services/appIcon";

const mockRequireOptional = requireOptionalNativeModule as jest.Mock;

const nativeMock = {
  supportsAlternateIcons: true,
  getAppIconName: jest.fn(() => null as string | null),
  setAlternateAppIcon: jest.fn(async (name: string | null) => name),
};

describe("appIcon service", () => {
  beforeEach(() => {
    nativeMock.supportsAlternateIcons = true;
    nativeMock.getAppIconName.mockReturnValue(null);
    mockRequireOptional.mockReturnValue(nativeMock);
  });

  describe("iconNameForTheme", () => {
    it("maps each theme to its bundled icon name", () => {
      expect(iconNameForTheme("default")).toBeNull();
      expect(iconNameForTheme("dark")).toBe("Dark");
      expect(iconNameForTheme("light")).toBe("Light");
    });
  });

  describe("alternateIconsSupported", () => {
    it("is true on iOS when the device reports support", () => {
      nativeMock.supportsAlternateIcons = true;
      expect(alternateIconsSupported()).toBe(true);
    });

    it("is false when the device does not support alternate icons", () => {
      nativeMock.supportsAlternateIcons = false;
      expect(alternateIconsSupported()).toBe(false);
    });

    it("is false when the native module is absent (e.g. Expo Go)", () => {
      mockRequireOptional.mockReturnValue(null);
      expect(alternateIconsSupported()).toBe(false);
    });
  });

  describe("getActiveIconName", () => {
    it("returns the native active icon when supported", () => {
      nativeMock.getAppIconName.mockReturnValue("Dark");
      expect(getActiveIconName()).toBe("Dark");
    });

    it("returns null when the native module is absent", () => {
      mockRequireOptional.mockReturnValue(null);
      expect(getActiveIconName()).toBeNull();
    });
  });

  describe("iconMatchesTheme", () => {
    it("is true when the live icon matches the theme mapping", () => {
      nativeMock.getAppIconName.mockReturnValue("Dark");
      expect(iconMatchesTheme("dark")).toBe(true);
    });

    it("is false when the live icon differs from the theme mapping", () => {
      nativeMock.getAppIconName.mockReturnValue("Dark");
      expect(iconMatchesTheme("light")).toBe(false);
    });

    it("treats the primary icon as matching the default theme", () => {
      nativeMock.getAppIconName.mockReturnValue(null);
      expect(iconMatchesTheme("default")).toBe(true);
    });

    it("reports a match when unsupported so the UI hides the option", () => {
      mockRequireOptional.mockReturnValue(null);
      expect(iconMatchesTheme("light")).toBe(true);
    });
  });

  describe("applyIconForTheme", () => {
    it("sets the alternate icon for a non-default theme", async () => {
      nativeMock.getAppIconName.mockReturnValue(null);

      const changed = await applyIconForTheme("dark");

      expect(changed).toBe(true);
      expect(nativeMock.setAlternateAppIcon).toHaveBeenCalledWith("Dark");
    });

    it("resets to the primary icon (null) for the default theme", async () => {
      nativeMock.getAppIconName.mockReturnValue("Dark");

      const changed = await applyIconForTheme("default");

      expect(changed).toBe(true);
      expect(nativeMock.setAlternateAppIcon).toHaveBeenCalledWith(null);
    });

    it("does nothing when the icon already matches the theme", async () => {
      nativeMock.getAppIconName.mockReturnValue("Light");

      const changed = await applyIconForTheme("light");

      expect(changed).toBe(false);
      expect(nativeMock.setAlternateAppIcon).not.toHaveBeenCalled();
    });

    it("does nothing when alternate icons are unsupported", async () => {
      nativeMock.supportsAlternateIcons = false;

      const changed = await applyIconForTheme("dark");

      expect(changed).toBe(false);
      expect(nativeMock.setAlternateAppIcon).not.toHaveBeenCalled();
    });

    it("does nothing when the native module is absent", async () => {
      mockRequireOptional.mockReturnValue(null);

      const changed = await applyIconForTheme("dark");

      expect(changed).toBe(false);
    });
  });
});
