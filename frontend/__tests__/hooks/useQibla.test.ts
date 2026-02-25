import { renderHook, waitFor, act } from "@testing-library/react-native";
import { AppState } from "react-native";

type Heading = {
  trueHeading?: number;
  magHeading?: number;
  accuracy?: number;
};

const mockRequestForegroundPermissionsAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();
const mockWatchHeadingAsync = jest.fn();
const mockHeadingRemove = jest.fn();

let appStateHandler: ((s: "active" | "background" | "inactive") => void) | null = null;
let headingHandler: ((h: Heading) => void) | null = null;

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    mockRequestForegroundPermissionsAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => mockGetCurrentPositionAsync(...args),
  watchHeadingAsync: (...args: unknown[]) => mockWatchHeadingAsync(...args),
}));

import useQibla from "@/hooks/useQibla";

describe("hooks/useQibla", () => {
  beforeEach(() => {
    appStateHandler = null;
    headingHandler = null;

    mockHeadingRemove.mockReset();
    mockRequestForegroundPermissionsAsync.mockReset();
    mockGetCurrentPositionAsync.mockReset();
    mockWatchHeadingAsync.mockReset();

    jest.spyOn(AppState, "addEventListener").mockImplementation(((event: string, cb: typeof appStateHandler) => {
      if (event === "change") appStateHandler = cb;
      return { remove: jest.fn() } as any;
    }) as any);

    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 40.7128, longitude: -74.006 },
    });
    mockWatchHeadingAsync.mockImplementation(async (cb: (h: Heading) => void) => {
      headingHandler = cb;
      return { remove: mockHeadingRemove };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sets location error when permission is denied", async () => {
    mockRequestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });

    const { result } = renderHook(() => useQibla());

    await waitFor(() => {
      expect(result.current.error).toBe("Location permission denied.");
    });

    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("sets location error when reading position fails", async () => {
    mockGetCurrentPositionAsync.mockRejectedValue(new Error("services off"));

    const { result } = renderHook(() => useQibla());

    await waitFor(() => {
      expect(result.current.error).toBe("Could not read your location.");
    });
  });

  it("sets compass sensor error when heading subscription fails", async () => {
    mockWatchHeadingAsync.mockRejectedValue(new Error("sensor unavailable"));

    const { result } = renderHook(() => useQibla());

    await waitFor(() => {
      expect(result.current.error).toBe("Could not access the compass sensor.");
    });
  });

  it("computes qibla, heading, rotation and alignment on happy path", async () => {
    const { result } = renderHook(() => useQibla());

    await waitFor(() => {
      expect(result.current.qiblaAngle).not.toBeNull();
      expect(typeof headingHandler).toBe("function");
    });

    act(() => {
      headingHandler?.({ trueHeading: 0, accuracy: 3 });
    });

    await waitFor(() => {
      expect(result.current.heading).toBe(0);
      expect(result.current.rotation).toBeCloseTo(result.current.qiblaAngle ?? 0, 5);
      expect(result.current.accuracy).toBe(3);
      expect(result.current.isAligned).toBe(false);
    });

    const qibla = result.current.qiblaAngle ?? 0;
    act(() => {
      for (let i = 0; i < 16; i += 1) {
        headingHandler?.({ trueHeading: qibla, accuracy: 3 });
      }
    });

    await waitFor(() => {
      expect(result.current.isAligned).toBe(true);
      expect(result.current.rotation).toBeCloseTo(0, 1);
    });
  });

  it("handles invalid heading payload and app-state stop", async () => {
    const { result } = renderHook(() => useQibla());

    await waitFor(() => {
      expect(typeof headingHandler).toBe("function");
    });

    act(() => {
      headingHandler?.({ trueHeading: -1, magHeading: -1, accuracy: 20 });
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Compass not available.");
    });

    act(() => {
      appStateHandler?.("background");
    });

    expect(mockHeadingRemove).toHaveBeenCalledTimes(1);
  });
});
