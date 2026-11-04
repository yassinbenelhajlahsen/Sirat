import { renderHook, act, waitFor } from "@testing-library/react-native";
import { Alert, Animated } from "react-native";

import { useDuaInteraction } from "@/hooks/useDuaInteraction";
import { getAnotherDua, requestDua, saveDuaToHistory, type Dua } from "@/services/duaService";

jest.mock("@/services/duaService", () => ({
  requestDua: jest.fn(),
  saveDuaToHistory: jest.fn(),
  getAnotherDua: jest.fn(),
}));

const mockGetAnotherDua = getAnotherDua as jest.MockedFunction<typeof getAnotherDua>;
const mockRequestDua = requestDua as jest.MockedFunction<typeof requestDua>;
const mockSaveDuaToHistory = saveDuaToHistory as jest.MockedFunction<typeof saveDuaToHistory>;

describe("hooks/useDuaInteraction", () => {
  beforeEach(() => {
    jest.clearAllMocks();

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
    jest.restoreAllMocks();
  });

  it("sets duaLoading and stores selected dua on success", async () => {
    const dua: Dua = {
      id: 17,
      category: "exam",
      arabic: "arabic",
      english: "english",
      transliteration: "translit",
      reference: "ref",
      source: "source",
    };

    mockRequestDua.mockResolvedValue(dua);
    mockSaveDuaToHistory.mockResolvedValue();

    const { result } = renderHook(() => useDuaInteraction());

    await act(async () => {
      await result.current.submitDua("help me");
    });

    expect(mockRequestDua).toHaveBeenCalledWith("help me");
    expect(mockSaveDuaToHistory).toHaveBeenCalledWith(dua);
    expect(result.current.selectedDua).toEqual(dua);
    expect(result.current.duaLoading).toBe(false);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("shows alert on request error and clears loading", async () => {
    mockRequestDua.mockRejectedValue(new Error("Backend down"));

    const { result } = renderHook(() => useDuaInteraction());

    await act(async () => {
      await result.current.submitDua("help me");
    });

    expect(mockSaveDuaToHistory).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Error", "Backend down");
    expect(result.current.duaLoading).toBe(false);
  });

  it("closes current dua via transition", async () => {
    const dua: Dua = {
      id: 100,
      category: "General",
      arabic: "arabic",
      english: "english",
      transliteration: "translit",
      reference: "ref",
      source: "source",
    };

    mockRequestDua.mockResolvedValue(dua);
    mockSaveDuaToHistory.mockResolvedValue();

    const { result } = renderHook(() => useDuaInteraction());

    await act(async () => {
      await result.current.submitDua("need dua");
    });

    expect(result.current.selectedDua).toEqual(dua);

    act(() => {
      result.current.closeDua();
    });

    await waitFor(() => {
      expect(result.current.selectedDua).toBeNull();
    });
  });

  it("asks for another dua within the shown dua's topic", async () => {
    const shown: Dua = {
      id: 7,
      category: "healing",
      arabic: "arabic",
      english: "english",
      transliteration: "translit",
      reference: "ref",
      source: "source",
    };
    const next: Dua = { ...shown, id: 8, category: "visiting_sick" };
    mockRequestDua.mockResolvedValue(shown);
    mockSaveDuaToHistory.mockResolvedValue();
    mockGetAnotherDua.mockReturnValue(next);

    const { result } = renderHook(() => useDuaInteraction());
    await act(async () => {
      await result.current.submitDua("feeling ill");
    });
    await act(async () => {
      result.current.anotherDua();
    });

    expect(mockGetAnotherDua).toHaveBeenCalledWith(
      expect.objectContaining({ id: "illness-healing" }),
      7,
    );
    expect(result.current.selectedDua).toEqual(next);
  });

  // Safe only because the cards are solid surfaces: Liquid Glass would render
  // as nothing under this animated wrapper.
  it("animates the swap when a dua appears and when it closes", async () => {
    const dua: Dua = {
      id: 42,
      category: "General",
      arabic: "arabic",
      english: "english",
      transliteration: "translit",
      reference: "ref",
      source: "source",
    };
    mockRequestDua.mockResolvedValue(dua);
    mockSaveDuaToHistory.mockResolvedValue();

    const { result } = renderHook(() => useDuaInteraction());
    await act(async () => {
      await result.current.submitDua("need dua");
    });
    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(Animated.spring).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.closeDua();
    });
    expect(result.current.selectedDua).toBeNull();
    expect(Animated.timing).toHaveBeenCalledTimes(2);
  });
});
