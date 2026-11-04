import AsyncStorage from "@react-native-async-storage/async-storage";
import { renderHook, waitFor } from "@testing-library/react-native";

import { usePrayerDay } from "@/hooks/usePrayerDay";

// Only the OS and the settings are mocked: the real facade and location code throw the real error.
jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  hasServicesEnabledAsync: jest.fn(async () => true),
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getCurrentPositionAsync: jest.fn(async () => {
    throw new Error("no fix");
  }),
  getLastKnownPositionAsync: jest.fn(async () => null),
  reverseGeocodeAsync: jest.fn(),
}));

// Effective settings normally always carry a city; a city-less one is the case the error exists for.
jest.mock("@/services/prayerSettings", () => ({
  getEffectivePrayerSettings: jest.fn(async () => ({ useLocation: true, method: 2 })),
}));

const day = new Date(2026, 1, 25);

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe("usePrayerDay with no location fix and no saved city", () => {
  it("shows a location error, which is what offers Open Settings", async () => {
    const { result } = renderHook(() => usePrayerDay(day));

    await waitFor(() => expect(result.current.error?.code).toBe("LOCATION"));
    expect(result.current.loading).toBe(false);
    expect(result.current.prayerDay).toBeNull();
  });
});
