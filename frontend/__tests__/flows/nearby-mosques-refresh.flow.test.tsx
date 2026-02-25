import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import MosqueScreen from "@/app/(tabs)/Mosques";
import * as Location from "expo-location";
import {
  getCachedMosques,
  getNearbyMosques,
  type Mosque,
} from "@/services/getNearbyMosques";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

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
    FontAwesome5: (props: object) => <View {...props} />,
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

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: jest.fn(async () => {}),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MapView = ({ children, ...rest }: { children: React.ReactNode }) => (
    <View {...rest}>{children}</View>
  );
  return {
    __esModule: true,
    default: MapView,
    Marker: ({ children, ...rest }: { children: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    Callout: ({ children, ...rest }: { children: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
  };
});

jest.mock("../../components/PressableScale", () => {
  const React = require("react");
  const { TouchableOpacity } = require("react-native");
  return function PressableScaleMock({
    children,
    ...rest
  }: {
    children: React.ReactNode;
  }) {
    return <TouchableOpacity {...rest}>{children}</TouchableOpacity>;
  };
});

jest.mock("@/services/getNearbyMosques", () => ({
  getCachedMosques: jest.fn(),
  getNearbyMosques: jest.fn(),
}));

const mockLocation = Location as jest.Mocked<typeof Location>;
const mockGetCachedMosques = getCachedMosques as jest.MockedFunction<
  typeof getCachedMosques
>;
const mockGetNearbyMosques = getNearbyMosques as jest.MockedFunction<
  typeof getNearbyMosques
>;

describe("flows/nearby-mosques-refresh", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("recovers from denied permission by retrying and loading nearby results", async () => {
    const rows: Mosque[] = [
      {
        id: "m1",
        name: "Downtown Masjid",
        address: "100 Main St",
        lat: 41.88,
        lng: -87.62,
      },
    ];

    mockLocation.hasServicesEnabledAsync.mockResolvedValue(true as never);
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: "denied",
    } as never);
    mockLocation.requestForegroundPermissionsAsync
      .mockResolvedValueOnce({ status: "denied" } as never)
      .mockResolvedValueOnce({ status: "granted" } as never);
    mockLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 41.881, longitude: -87.623 },
    } as never);

    mockGetCachedMosques.mockResolvedValue([]);
    mockGetNearbyMosques.mockResolvedValue(rows);

    const { getByText, getByLabelText, queryAllByText } = render(<MosqueScreen />);

    await waitFor(() => {
      expect(getByText("Allow Location Access")).toBeTruthy();
    });
    expect(queryAllByText("Downtown Masjid")).toHaveLength(0);

    fireEvent.press(getByLabelText("Retry location permission"));

    await waitFor(() => {
      expect(queryAllByText("Downtown Masjid").length).toBeGreaterThan(0);
    });

    expect(mockLocation.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(
      2,
    );
    expect(mockGetNearbyMosques).toHaveBeenCalledTimes(1);
    expect(Alert.alert).not.toHaveBeenCalledWith(
      "Error",
      "Failed to load nearby mosques.",
    );
  });
});
