import { render } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";

import NotificationSettingsPage from "@/app/Settings/notifications";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");
  return { ...actual, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

jest.mock("@/components/NotificationSettings", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ notifStatus }: { notifStatus: string | null }) => (
      <Text>{`NotificationSettings:${notifStatus}`}</Text>
    ),
  };
});

describe("Settings > Notifications page", () => {
  it("passes the OS permission status to the notification settings", async () => {
    jest
      .spyOn(Notifications, "getPermissionsAsync")
      .mockResolvedValue({ granted: true } as Notifications.NotificationPermissionsStatus);

    const { findByText } = render(
      <ThemeProvider>
        <NotificationSettingsPage />
      </ThemeProvider>,
    );

    expect(await findByText("NotificationSettings:granted")).toBeTruthy();
  });

  it("falls back to denied when the permission read fails", async () => {
    jest.spyOn(Notifications, "getPermissionsAsync").mockRejectedValue(new Error("nope"));

    const { findByText } = render(
      <ThemeProvider>
        <NotificationSettingsPage />
      </ThemeProvider>,
    );

    expect(await findByText("NotificationSettings:denied")).toBeTruthy();
  });
});
