import { act, renderHook, waitFor } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";
import type { EmitterSubscription } from "react-native";

import { useQuranDisplayModes } from "@/hooks/useQuranDisplayModes";
import {
  QURAN_DISPLAY_MODES_UPDATED_EVENT,
  getCachedQuranDisplayModes,
  getQuranDisplayModes,
  saveQuranDisplayModes,
  toggleQuranDisplayMode,
} from "@/services/quranDisplayModes";

jest.mock("@/services/quranDisplayModes", () => ({
  DEFAULT_QURAN_DISPLAY_MODES: ["arabic"],
  QURAN_DISPLAY_MODES_UPDATED_EVENT: "QURAN_DISPLAY_MODES_UPDATED",
  getCachedQuranDisplayModes: jest.fn(),
  getQuranDisplayModes: jest.fn(),
  saveQuranDisplayModes: jest.fn(),
  toggleQuranDisplayMode: jest.fn(),
}));

const mockGetCachedQuranDisplayModes = getCachedQuranDisplayModes as jest.MockedFunction<
  typeof getCachedQuranDisplayModes
>;
const mockGetQuranDisplayModes = getQuranDisplayModes as jest.MockedFunction<
  typeof getQuranDisplayModes
>;
const mockSaveQuranDisplayModes = saveQuranDisplayModes as jest.MockedFunction<
  typeof saveQuranDisplayModes
>;
const mockToggleQuranDisplayMode = toggleQuranDisplayMode as jest.MockedFunction<
  typeof toggleQuranDisplayMode
>;

describe("useQuranDisplayModes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCachedQuranDisplayModes.mockReturnValue([]);
    mockGetQuranDisplayModes.mockResolvedValue(["arabic", "english"]);
    mockSaveQuranDisplayModes.mockResolvedValue(["arabic", "transliteration"]);
    mockToggleQuranDisplayMode.mockResolvedValue(["arabic"]);
  });

  it("uses fallback defaults before async load, then applies loaded modes", async () => {
    const { result } = renderHook(() => useQuranDisplayModes());

    expect(result.current.displayModes).toEqual(["arabic"]);
    expect(result.current.displayModesLoaded).toBe(false);

    await waitFor(() => {
      expect(result.current.displayModes).toEqual(["arabic", "english"]);
      expect(result.current.displayModesLoaded).toBe(true);
    });
  });

  it("syncs state from QURAN_DISPLAY_MODES_UPDATED events", async () => {
    let listener: ((value: unknown) => void) | undefined;
    const remove = jest.fn();
    const addListenerSpy = jest
      .spyOn(DeviceEventEmitter, "addListener")
      .mockImplementation((eventName, handler) => {
        if (eventName === QURAN_DISPLAY_MODES_UPDATED_EVENT) {
          listener = handler as (value: unknown) => void;
        }
        return { remove } as unknown as EmitterSubscription;
      });

    const { result, unmount } = renderHook(() => useQuranDisplayModes());

    await waitFor(() => {
      expect(result.current.displayModesLoaded).toBe(true);
    });

    act(() => {
      listener?.(["transliteration"]);
    });
    expect(result.current.displayModes).toEqual(["transliteration"]);

    act(() => {
      listener?.("bad-payload");
    });
    expect(result.current.displayModes).toEqual(["transliteration"]);

    unmount();
    expect(remove).toHaveBeenCalledTimes(1);

    addListenerSpy.mockRestore();
  });

  it("persists explicit modes and toggles through service helpers", async () => {
    const { result } = renderHook(() => useQuranDisplayModes());

    await waitFor(() => {
      expect(result.current.displayModesLoaded).toBe(true);
    });

    await act(async () => {
      await result.current.persistDisplayModes(["arabic", "transliteration"]);
    });

    expect(mockSaveQuranDisplayModes).toHaveBeenCalledWith(["arabic", "transliteration"]);
    expect(result.current.displayModes).toEqual(["arabic", "transliteration"]);

    await act(async () => {
      await result.current.toggleDisplayMode("english");
    });

    expect(mockToggleQuranDisplayMode).toHaveBeenCalledWith("english");
    expect(result.current.displayModes).toEqual(["arabic"]);
  });
});
