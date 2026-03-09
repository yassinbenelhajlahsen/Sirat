import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import * as Network from "expo-network";
import { Alert, Animated } from "react-native";

import { useDuaInteraction } from "@/hooks/useDuaInteraction";
import type { Dua } from "@/services/duaService";

jest.mock("@/services/apiClient", () => ({
  apiPost: jest.fn(),
  AppUpdateRequiredError: class AppUpdateRequiredError extends Error {
    minVersion: string;
    currentVersion: string;
    constructor(minVersion: string, currentVersion: string) {
      super("APP_UPDATE_REQUIRED");
      this.name = "AppUpdateRequiredError";
      this.minVersion = minVersion;
      this.currentVersion = currentVersion;
    }
  },
}));

import { apiPost } from "@/services/apiClient";

const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockGetNetworkStateAsync = Network.getNetworkStateAsync as jest.MockedFunction<
  typeof Network.getNetworkStateAsync
>;

describe("flows/dua-request-history", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    await AsyncStorage.clear();

    jest.spyOn(Math, "random").mockReturnValue(0);

    jest.spyOn(Animated, "timing").mockImplementation(
      ((_value: Animated.Value, _config: Animated.TimingAnimationConfig) => ({
        start: (cb?: Animated.EndCallback) => cb?.({ finished: true }),
        stop: jest.fn(),
        reset: jest.fn(),
      })) as unknown as typeof Animated.timing,
    );

    jest.spyOn(Animated, "spring").mockImplementation(
      ((_value: Animated.Value, _config: Animated.SpringAnimationConfig) => ({
        start: (cb?: Animated.EndCallback) => cb?.({ finished: true }),
        stop: jest.fn(),
        reset: jest.fn(),
      })) as unknown as typeof Animated.spring,
    );

    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("transitions loading to success and persists the selected dua into history", async () => {
    const { result } = renderHook(() => useDuaInteraction());

    let submitPromise!: Promise<void>;
    act(() => {
      submitPromise = result.current.submitDua("I have an exam tomorrow");
    });

    expect(result.current.duaLoading).toBe(true);
    expect(result.current.selectedDua).toBeNull();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1199);
    });
    expect(result.current.duaLoading).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1);
      await submitPromise;
    });

    expect(result.current.duaLoading).toBe(false);
    expect(result.current.selectedDua).not.toBeNull();
    expect(result.current.selectedDua?.category).toBe("exam");
    expect(Alert.alert).not.toHaveBeenCalled();

    const rawHistory = await AsyncStorage.getItem("dua_history_v1");
    const history = rawHistory ? (JSON.parse(rawHistory) as Dua[]) : [];

    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(result.current.selectedDua?.id);
    expect(history[0].category).toBe("exam");
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("transitions loading to error and does not persist history when backend rejects", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    } as Network.NetworkState);
    mockApiPost.mockRejectedValue(new Error("Request too short"));

    const { result } = renderHook(() => useDuaInteraction());

    let submitPromise!: Promise<void>;
    act(() => {
      submitPromise = result.current.submitDua("xylophone zebra quartz");
    });

    expect(result.current.duaLoading).toBe(true);

    await act(async () => {
      await submitPromise;
    });

    expect(result.current.duaLoading).toBe(false);
    expect(result.current.selectedDua).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith("Error", "Request too short");
    expect(mockApiPost).toHaveBeenCalledTimes(1);

    const rawHistory = await AsyncStorage.getItem("dua_history_v1");
    expect(rawHistory).toBeNull();
  });
});
