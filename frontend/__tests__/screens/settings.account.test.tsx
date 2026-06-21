import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockDeleteAccount = jest.fn().mockResolvedValue(undefined);
const mockSignOut = jest.fn().mockResolvedValue(undefined);

// --- expo-router ---
jest.mock("expo-router", () => ({
  router: { push: (p: string) => mockPush(p), back: jest.fn() },
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));

// --- account hooks ---
jest.mock("@/hooks/useAuthState", () => ({
  useAuthState: jest.fn(() => ({
    isLoaded: true,
    isSignedIn: true,
    userId: "u1",
    email: "a@b.com",
  })),
}));
jest.mock("@/hooks/useAccountActions", () => ({
  useAccountActions: () => ({ signOut: mockSignOut, deleteAccount: mockDeleteAccount }),
}));

// --- theme ---
jest.mock("@/context/ThemeContext", () => ({
  useTheme: jest.fn(() => ({
    theme: require("@/constants/theme").defaultTheme,
    themeName: "default",
    setTheme: jest.fn(),
  })),
}));

// --- safe area ---
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
  };
});

// --- prayer/notification hooks ---
jest.mock("@/hooks/usePrayerSettingsState", () => ({
  usePrayerSettingsState: jest.fn(() => ({
    useLocation: true,
    setUseLocation: jest.fn(),
    method: 2,
    setMethod: jest.fn(),
    city: { name: "Chicago", country: "US" },
    cityModalVisible: false,
    setCityModalVisible: jest.fn(),
    cityItems: [],
    selectCityByKey: jest.fn(),
  })),
}));
jest.mock("@/hooks/useSettingsPermissions", () => ({
  useSettingsPermissions: jest.fn(() => ({
    permissionStatus: "granted",
    notifStatus: "granted",
    handleLocationToggle: jest.fn(),
  })),
}));
jest.mock("@/hooks/useHaptics", () => ({
  useHaptics: jest.fn(() => jest.fn()),
}));

// --- notification settings component (owns its own section) ---
jest.mock("@/components/NotificationSettings", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function NotificationSettingsMock({ notifStatus }: { notifStatus: string }) {
    return <Text>NotificationSettings:{notifStatus}</Text>;
  };
});

// --- picker dialog ---
jest.mock("@/components/settings/PickerDialog", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View /> };
});

// --- app icon service ---
jest.mock("@/services/appIcon", () => ({
  alternateIconsSupported: jest.fn(() => false),
  getActiveIconName: jest.fn(() => null),
  iconNameForTheme: jest.fn(() => null),
  applyIconForTheme: jest.fn(async () => {}),
}));

// --- app links utility ---
jest.mock("@/utils/appLinks", () => ({
  getAppVersion: jest.fn(() => "1.0.0"),
  openPrivacy: jest.fn(),
  openWebsite: jest.fn(),
  rateApp: jest.fn(),
  sendFeedback: jest.fn(),
  shareApp: jest.fn(),
}));

// --- icons ---
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Ionicons: (props: unknown) => <View {...(props as object)} />,
  };
});

// --- linear gradient ---
jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...props }: { children: React.ReactNode }) => (
      <View {...props}>{children}</View>
    ),
  };
});

// --- pressable scale ---
jest.mock("@/components/PressableScale", () => {
  const React = require("react");
  const { TouchableOpacity } = require("react-native");
  return function PressableScaleMock({
    children,
    onPress,
    ...rest
  }: {
    children: React.ReactNode;
    onPress?: () => void;
  }) {
    return (
      <TouchableOpacity onPress={onPress} {...rest}>
        {children}
      </TouchableOpacity>
    );
  };
});

import { Alert } from "react-native";
import { useAuthState } from "@/hooks/useAuthState";
import Settings from "@/app/Settings";

const mockUseAuthState = useAuthState as jest.MockedFunction<typeof useAuthState>;

describe("Settings account integration", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockSignOut.mockReset().mockResolvedValue(undefined);
    mockDeleteAccount.mockReset().mockResolvedValue(undefined);

    // Default to signed-in for most tests
    mockUseAuthState.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      userId: "u1",
      email: "a@b.com",
      firstName: null,
    });
  });

  it("opens the sign-in route from the account row when signed out", () => {
    mockUseAuthState.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      userId: null,
      email: null,
      firstName: null,
    });

    const { getByLabelText } = render(<Settings />);
    fireEvent.press(getByLabelText("Sign in"));
    expect(mockPush).toHaveBeenCalledWith("/SignIn");
  });

  it("renders the signed-in email in Settings", () => {
    const { getByText } = render(<Settings />);
    expect(getByText("a@b.com")).toBeTruthy();
  });

  it("sign out triggers the action", () => {
    const { getByLabelText } = render(<Settings />);
    fireEvent.press(getByLabelText("Sign out"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("pressing Delete account row opens confirmation dialog and Delete button calls deleteAccount", () => {
    const alertSpy = jest.spyOn(Alert, "alert");

    const { getByLabelText } = render(<Settings />);
    fireEvent.press(getByLabelText("Delete account"));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const [, , buttons] = alertSpy.mock.calls[0] as [string, string, { text: string; style?: string; onPress?: () => void }[]];
    const deleteButton = buttons?.find((b) => b.text === "Delete");
    expect(deleteButton).toBeDefined();

    deleteButton!.onPress!();
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);

    alertSpy.mockRestore();
  });
});
