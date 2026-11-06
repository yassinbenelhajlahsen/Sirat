import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";
import { Alert, Animated } from "react-native";

import { useDuaInteraction } from "@/hooks/useDuaInteraction";
import type { Dua } from "@/services/duaService";

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
  });

  it("shows the crisis notice, not the no-match line, for a self-harm request, and stores no trace of it", async () => {
    const { result } = renderHook(() => useDuaInteraction());

    let submitPromise!: Promise<void>;
    act(() => {
      submitPromise = result.current.submitDua("I want to kill myself");
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1200);
      await submitPromise;
    });

    expect(result.current.notice).toBe("crisis");
    expect(result.current.selectedDua?.id).toBe(39);

    const rawHistory = (await AsyncStorage.getItem("dua_history_v1")) ?? "";
    expect(rawHistory).not.toMatch(/kill|crisis|notice|no-match/i);
  });

  it("transitions loading to error and does not persist history for an empty request", async () => {
    const { result } = renderHook(() => useDuaInteraction());

    await act(async () => {
      await result.current.submitDua("   ");
    });

    expect(result.current.duaLoading).toBe(false);
    expect(result.current.selectedDua).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith("Error", "Please enter what you need help with");

    const rawHistory = await AsyncStorage.getItem("dua_history_v1");
    expect(rawHistory).toBeNull();
  });
});
