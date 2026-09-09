import { ActionSheetIOS, Alert, Platform } from "react-native";

import { defaultTheme, lightTheme } from "@/constants/theme";
import { showActionMenu } from "@/utils/actionMenu";

describe("showActionMenu", () => {
  const edit = jest.fn();
  const archive = jest.fn();
  const options = [
    { label: "Edit", onPress: edit },
    { label: "Archive", onPress: archive, destructive: true },
  ];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("presents a native action sheet on iOS with Cancel last and destructive marked", () => {
    const spy = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(
      (_opts, cb) => cb(1),
    );
    showActionMenu({ title: "Read Qur'an", options, theme: defaultTheme });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Read Qur'an",
        options: ["Edit", "Archive", "Cancel"],
        cancelButtonIndex: 2,
        destructiveButtonIndex: [1],
        userInterfaceStyle: "dark",
      }),
      expect.any(Function),
    );
    expect(archive).toHaveBeenCalledTimes(1);
    expect(edit).not.toHaveBeenCalled();
  });

  it("asks the sheet to match the Light theme", () => {
    const spy = jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation(() => {});
    showActionMenu({ title: "x", options, theme: lightTheme });
    expect(spy.mock.calls[0][0].userInterfaceStyle).toBe("light");
  });

  it("ignores the Cancel index", () => {
    jest.spyOn(ActionSheetIOS, "showActionSheetWithOptions").mockImplementation((_o, cb) => cb(2));
    showActionMenu({ title: "x", options, theme: defaultTheme });
    expect(edit).not.toHaveBeenCalled();
    expect(archive).not.toHaveBeenCalled();
  });

  it("falls back to an Alert on other platforms", () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    try {
      showActionMenu({ title: "Read Qur'an", options, theme: defaultTheme });
      expect(alertSpy).toHaveBeenCalledWith(
        "Read Qur'an",
        undefined,
        expect.arrayContaining([
          expect.objectContaining({ text: "Edit" }),
          expect.objectContaining({ text: "Archive", style: "destructive" }),
          expect.objectContaining({ text: "Cancel", style: "cancel" }),
        ]),
      );
    } finally {
      Object.defineProperty(Platform, "OS", { value: original, configurable: true });
    }
  });
});
