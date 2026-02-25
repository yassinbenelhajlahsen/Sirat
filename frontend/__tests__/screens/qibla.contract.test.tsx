import React from "react";
import { Alert, Linking } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import QiblaScreen from "@/app/(tabs)/Qibla";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import useQibla from "@/hooks/useQibla";

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => {
    const { defaultTheme } = require("@/constants/theme");
    return { theme: defaultTheme };
  },
}));

jest.mock("expo-linear-gradient", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    LinearGradient: ({ children, ...rest }: { children: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
  };
});

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Ionicons: (props: object) => <View {...props} />,
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaView: ({ children, ...rest }: { children: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
  };
});

jest.mock("expo-location", () => ({
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: jest.fn(async () => {}),
}));

jest.mock("react-native-reanimated", () => {
  const { Image } = require("react-native");

  function useSharedValue(initial: number) {
    const shared = {
      value: initial,
      get: () => shared.value,
    };
    return shared;
  }

  return {
    __esModule: true,
    default: { Image },
    useSharedValue,
    useAnimatedStyle: (updater: () => object) => updater(),
    withSpring: (value: number) => value,
  };
});

jest.mock("@/hooks/useQibla", () => jest.fn());

const mockUseQibla = useQibla as jest.MockedFunction<typeof useQibla>;
const mockLocation = Location as jest.Mocked<typeof Location>;
const mockHaptics = Haptics as jest.Mocked<typeof Haptics>;

function primeQibla(overrides?: Partial<ReturnType<typeof useQibla>>) {
  mockUseQibla.mockReturnValue({
    rotation: null,
    heading: null,
    qiblaAngle: null,
    accuracy: null,
    error: null,
    isAligned: false,
    ...overrides,
  });
}

describe("screens/Qibla contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.hasServicesEnabledAsync.mockResolvedValue(true as never);
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    primeQibla();
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders services-off gate branch and retry action contract", async () => {
    mockLocation.hasServicesEnabledAsync.mockResolvedValue(false as never);
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: "undetermined",
    } as never);

    const { getByText, getByLabelText } = render(<QiblaScreen />);

    await waitFor(() => {
      expect(getByText("Location Services Off")).toBeTruthy();
    });
    expect(
      getByText("Location is required to calculate the Qibla direction."),
    ).toBeTruthy();

    fireEvent.press(getByLabelText("How to turn on location services"));
    expect(Alert.alert).toHaveBeenCalledWith(
      "Turn On Location Services",
      expect.any(String),
    );

    fireEvent.press(getByLabelText("Retry location setup"));
    await waitFor(() => {
      expect(mockLocation.hasServicesEnabledAsync).toHaveBeenCalledTimes(3);
    });
  });

  it("renders denied-permission gate branch and opens device settings", async () => {
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    } as never);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    } as never);

    const { getByText, getByLabelText } = render(<QiblaScreen />);

    await waitFor(() => {
      expect(getByText("Allow Location Access")).toBeTruthy();
    });

    fireEvent.press(getByLabelText("Open device settings"));

    await waitFor(() => {
      expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    });
  });

  it("renders undetermined gate branch and re-requests permission on enable", async () => {
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: "undetermined",
    } as never);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "undetermined",
    } as never);

    const { getByText, getByLabelText } = render(<QiblaScreen />);

    await waitFor(() => {
      expect(getByText("We need your location")).toBeTruthy();
    });

    fireEvent.press(getByLabelText("Enable location"));

    await waitFor(() => {
      expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(2);
    });
  });

  it("renders runtime loading branch when rotation is unavailable", async () => {
    primeQibla({
      rotation: null,
      accuracy: null,
      isAligned: false,
      error: null,
    });

    const { getByText, queryByText } = render(<QiblaScreen />);

    await waitFor(() => {
      expect(getByText("Finding direction...")).toBeTruthy();
    });
    expect(getByText("Calibrating compass...")).toBeTruthy();
    expect(getByText("Adjusting")).toBeTruthy();
    expect(queryByText("Location Services Off")).toBeNull();
  });

  it("renders runtime error branch when hook returns an error", async () => {
    primeQibla({
      rotation: 18,
      accuracy: 10,
      error: "Compass not available.",
    });

    const { getByText } = render(<QiblaScreen />);

    await waitFor(() => {
      expect(getByText("Compass not available.")).toBeTruthy();
    });
    expect(
      getByText("Move your phone in a figure eight to improve compass accuracy."),
    ).toBeTruthy();
  });

  it("renders aligned runtime state and triggers haptic feedback", async () => {
    primeQibla({
      rotation: 1,
      accuracy: 2.4,
      isAligned: true,
      error: null,
    });

    const { getByText } = render(<QiblaScreen />);

    await waitFor(() => {
      expect(getByText("Accuracy ±2°")).toBeTruthy();
      expect(getByText("Aligned")).toBeTruthy();
    });
    expect(mockHaptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });
});
