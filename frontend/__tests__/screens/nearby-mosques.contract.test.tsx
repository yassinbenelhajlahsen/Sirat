import React from "react";
import { Alert } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";

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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function primeGrantedLocation() {
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
}

describe("screens/nearby-mosques contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders cached-first content, then replaces with fresh nearby results", async () => {
    primeGrantedLocation();

    const cachedRows: Mosque[] = [
      {
        id: "cached-1",
        name: "Cached Masjid",
        address: "123 Cache St",
        lat: 41.88,
        lng: -87.62,
      },
    ];
    const freshRows: Mosque[] = [
      {
        id: "fresh-1",
        name: "Fresh Masjid",
        address: "456 Fresh Ave",
        lat: 41.89,
        lng: -87.63,
      },
    ];

    const deferredFresh = createDeferred<Mosque[]>();
    mockGetCachedMosques.mockResolvedValue(cachedRows);
    mockGetNearbyMosques.mockReturnValue(deferredFresh.promise);

    const { queryAllByText } = render(<MosqueScreen />);

    await waitFor(() => {
      expect(queryAllByText("Cached Masjid").length).toBeGreaterThan(0);
    });
    expect(queryAllByText("Fresh Masjid")).toHaveLength(0);

    deferredFresh.resolve(freshRows);

    await waitFor(() => {
      expect(queryAllByText("Fresh Masjid").length).toBeGreaterThan(0);
    });
  });

  it("renders deterministic empty state when no nearby mosques are returned", async () => {
    primeGrantedLocation();
    mockGetCachedMosques.mockResolvedValue([]);
    mockGetNearbyMosques.mockResolvedValue([]);

    const { getByText } = render(<MosqueScreen />);

    await waitFor(() => {
      expect(
        getByText("No mosques found near your current location."),
      ).toBeTruthy();
    });
  });

  it("shows error alert when fresh fetch fails and no cached data is available", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    primeGrantedLocation();

    mockGetCachedMosques.mockResolvedValue([]);
    mockGetNearbyMosques.mockRejectedValue(new Error("network down"));

    render(<MosqueScreen />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Error",
        "Failed to load nearby mosques.",
      );
    });

    consoleErrorSpy.mockRestore();
  });
});
