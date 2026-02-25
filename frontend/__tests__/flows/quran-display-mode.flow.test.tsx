import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";

import { useQuranDisplayModes } from "@/hooks/useQuranDisplayModes";
import * as QuranDisplayModesService from "@/services/quranDisplayModes";

type Listener = (...args: unknown[]) => void;

function wireDeviceEventEmitter() {
  const listeners = new Map<string, Set<Listener>>();

  const addListenerSpy = jest
    .spyOn(DeviceEventEmitter, "addListener")
    .mockImplementation(((eventName: string, handler: Listener) => {
      const key = String(eventName);
      const byEvent = listeners.get(key) ?? new Set<Listener>();
      byEvent.add(handler);
      listeners.set(key, byEvent);

      return {
        remove: () => {
          byEvent.delete(handler);
        },
      } as { remove: () => void };
    }) as any);

  const emitSpy = jest
    .spyOn(DeviceEventEmitter, "emit")
    .mockImplementation((eventName: string, ...args: unknown[]) => {
      const key = String(eventName);
      listeners.get(key)?.forEach((handler) => handler(...args));
      return true;
    });

  return { addListenerSpy, emitSpy };
}

describe("flows/quran-display-mode", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("falls back safely when stored display modes are invalid", async () => {
    await AsyncStorage.setItem(
      QuranDisplayModesService.QURAN_DISPLAY_MODES_STORAGE_KEY,
      "not-json",
    );

    wireDeviceEventEmitter();
    const { result } = renderHook(() => useQuranDisplayModes());

    expect(result.current.displayModesLoaded).toBe(false);
    expect(result.current.displayModes).toEqual(["arabic"]);

    await waitFor(() => {
      expect(result.current.displayModesLoaded).toBe(true);
    });

    expect(result.current.displayModes).toEqual(["arabic"]);
  });

  it("loads current modes, persists updates, and syncs hook state from emitted events", async () => {
    await QuranDisplayModesService.saveQuranDisplayModes(["english", "arabic"]);

    const { emitSpy } = wireDeviceEventEmitter();
    const setItemSpy = jest.spyOn(AsyncStorage, "setItem");

    const { result } = renderHook(() => useQuranDisplayModes());

    expect(result.current.displayModesLoaded).toBe(false);
    expect(result.current.displayModes).toEqual(["english", "arabic"]);

    await waitFor(() => {
      expect(result.current.displayModesLoaded).toBe(true);
      expect(result.current.displayModes).toEqual(["english", "arabic"]);
    });

    emitSpy.mockClear();
    setItemSpy.mockClear();

    await act(async () => {
      await result.current.persistDisplayModes(["arabic", "transliteration"]);
    });

    expect(setItemSpy).toHaveBeenCalledWith(
      QuranDisplayModesService.QURAN_DISPLAY_MODES_STORAGE_KEY,
      JSON.stringify(["arabic", "transliteration"]),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      QuranDisplayModesService.QURAN_DISPLAY_MODES_UPDATED_EVENT,
      ["arabic", "transliteration"],
    );
    expect(result.current.displayModes).toEqual(["arabic", "transliteration"]);

    act(() => {
      DeviceEventEmitter.emit(
        QuranDisplayModesService.QURAN_DISPLAY_MODES_UPDATED_EVENT,
        ["english"],
      );
    });

    expect(result.current.displayModes).toEqual(["english"]);
  });
});
