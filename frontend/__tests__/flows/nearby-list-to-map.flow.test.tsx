import React from "react";
import { InteractionManager } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import MosqueScreen from "@/app/(tabs)/Mosques";
import MosqueMapScreen from "@/app/MosqueMap";
import * as Location from "expo-location";
import {
  getCachedMosques,
  getNearbyMosques,
  type Mosque,
} from "@/services/getNearbyMosques";

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
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
    <View testID="map-view" {...rest}>
      {children}
    </View>
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
    CalloutSubview: ({ children, ...rest }: { children: React.ReactNode }) => (
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

describe("flows/nearby-list-to-map", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    jest
      .spyOn(InteractionManager, "runAfterInteractions")
      .mockImplementation(
        ((task?: unknown) => {
          if (typeof task === "function") {
            task();
          } else if (
            task &&
            typeof task === "object" &&
            "run" in (task as { run?: unknown }) &&
            typeof (task as { run?: unknown }).run === "function"
          ) {
            (task as { run: () => void }).run();
          }

          return {
            then: jest.fn(),
            done: jest.fn(),
            cancel: jest.fn(),
          };
        }) as unknown as typeof InteractionManager.runAfterInteractions,
      );

    mockLocation.hasServicesEnabledAsync.mockResolvedValue(true as never);
    mockLocation.getForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: "granted",
    } as never);
    mockLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 41.881, longitude: -87.623 },
    } as never);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("keeps mosque marker continuity when opening full map from nearby list", async () => {
    const sharedRows: Mosque[] = [
      {
        id: "cont-1",
        name: "Continuity Masjid",
        address: "77 Unity Rd",
        lat: 41.882,
        lng: -87.624,
      },
    ];

    mockGetCachedMosques.mockResolvedValue(sharedRows);
    mockGetNearbyMosques.mockResolvedValue(sharedRows);

    const nearby = render(<MosqueScreen />);

    await waitFor(() => {
      expect(nearby.queryAllByText("Continuity Masjid").length).toBeGreaterThan(
        0,
      );
    });

    fireEvent.press(nearby.getByLabelText("Open full mosque map"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("../MosqueMap");
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    nearby.unmount();

    const fullMap = render(<MosqueMapScreen />);

    await waitFor(() => {
      expect(fullMap.queryAllByText("Continuity Masjid").length).toBeGreaterThan(
        0,
      );
    });

    expect(mockGetCachedMosques).toHaveBeenCalledTimes(2);
    expect(mockGetCachedMosques).toHaveBeenNthCalledWith(1, 41.881, -87.623);
    expect(mockGetCachedMosques).toHaveBeenNthCalledWith(2, 41.881, -87.623);
    expect(mockGetNearbyMosques).toHaveBeenCalledTimes(2);
  });
});
