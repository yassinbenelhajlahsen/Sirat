// frontend/__tests__/utils/appLinks.test.ts
import { Linking, Share } from "react-native";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.2.3" } },
}));

import {
  getAppVersion,
  openWebsite,
  openPrivacy,
  shareApp,
  sendFeedback,
  rateApp,
} from "@/utils/appLinks";

describe("appLinks", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the app version from expo config", () => {
    expect(getAppVersion()).toBe("1.2.3");
  });

  it("opens the website", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await openWebsite();
    expect(spy).toHaveBeenCalledWith("https://sirat.dev");
  });

  it("opens the privacy policy", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await openPrivacy();
    expect(spy).toHaveBeenCalledWith("https://sirat.dev/privacy");
  });

  it("shares the app with the store url", async () => {
    const spy = jest
      .spyOn(Share, "share")
      .mockResolvedValue({ action: "sharedAction" } as never);
    await shareApp();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        url: "https://apps.apple.com/app/id6753838183",
      }),
    );
  });

  it("opens a mailto for feedback", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await sendFeedback();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatch(
      /^mailto:yassinbenelhajlahsen@gmail\.com\?subject=/,
    );
  });

  it("opens the App Store review deep link", async () => {
    const spy = jest.spyOn(Linking, "openURL").mockResolvedValue(true as never);
    await rateApp();
    expect(spy).toHaveBeenCalledWith(
      "itms-apps://apps.apple.com/app/id6753838183?action=write-review",
    );
  });

  it("never throws when a link fails", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no handler"));
    await expect(openWebsite()).resolves.toBeUndefined();
  });
});
