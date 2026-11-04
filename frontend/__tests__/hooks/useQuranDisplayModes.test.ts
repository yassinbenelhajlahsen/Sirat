import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useQuranDisplayModes } from "@/hooks/useQuranDisplayModes";
import { quranDisplayModesSetting } from "@/services/syncedSettings";

describe("useQuranDisplayModes", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("starts from the default, then applies the stored modes", async () => {
    await AsyncStorage.setItem("quran_display_modes", JSON.stringify(["arabic", "english"]));
    const { result } = renderHook(() => useQuranDisplayModes());

    await waitFor(() => expect(result.current.displayModesLoaded).toBe(true));
    expect(result.current.displayModes).toEqual(["arabic", "english"]);
    expect(result.current.isModeEnabled("english")).toBe(true);
    expect(result.current.isModeEnabled("transliteration")).toBe(false);
  });

  it("falls back to the default when stored modes are invalid", async () => {
    await AsyncStorage.setItem("quran_display_modes", "not-json");
    const { result } = renderHook(() => useQuranDisplayModes());

    await waitFor(() => expect(result.current.displayModesLoaded).toBe(true));
    expect(result.current.displayModes).toEqual(["arabic"]);
  });

  it("follows modes synced in from another device", async () => {
    const { result } = renderHook(() => useQuranDisplayModes());
    await waitFor(() => expect(result.current.displayModesLoaded).toBe(true));

    await act(async () => {
      await quranDisplayModesSetting.applyRemote(["transliteration"]);
    });

    expect(result.current.displayModes).toEqual(["transliteration"]);
  });

  it("persists explicit modes and toggles", async () => {
    const { result } = renderHook(() => useQuranDisplayModes());
    await waitFor(() => expect(result.current.displayModesLoaded).toBe(true));

    await act(async () => {
      await result.current.persistDisplayModes(["english"]);
    });
    expect(result.current.displayModes).toEqual(["english"]);

    await act(async () => {
      await result.current.toggleDisplayMode("arabic");
    });
    expect(result.current.displayModes).toEqual(["english", "arabic"]);
  });
});
