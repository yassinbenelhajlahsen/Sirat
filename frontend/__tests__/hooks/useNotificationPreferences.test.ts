import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";

import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import {
  DEFAULT_PREFS,
  DEFAULT_WINDOW_PREFS,
  NOTIF_PREFS_UPDATED_EVENT,
  STORAGE_ENABLED,
  STORAGE_MAP,
  STORAGE_SOUND_MODE,
  STORAGE_WINDOW_MAP,
  STORAGE_WINDOW_OFFSET,
} from "@/utils/notifications/constants";

describe("useNotificationPreferences", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("hydrates enabled, prefs, and sound mode from storage", async () => {
    await AsyncStorage.multiSet([
      [
        STORAGE_MAP,
        JSON.stringify({
          Fajr: false,
          Isha: false,
          invalid: true,
          Asr: "bad",
        }),
      ],
      [STORAGE_ENABLED, "1"],
      [STORAGE_SOUND_MODE, "adhan"],
    ]);

    const { result } = renderHook(() =>
      useNotificationPreferences({ notifStatus: null }),
    );

    expect(result.current.loaded).toBe(false);
    expect(result.current.enabled).toBe(false);
    expect(result.current.prefs).toEqual(DEFAULT_PREFS);
    expect(result.current.soundMode).toBe("default");

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.enabled).toBe(true);
    expect(result.current.soundMode).toBe("adhan");
    expect(result.current.prefs).toEqual({
      ...DEFAULT_PREFS,
      Fajr: false,
      Isha: false,
    });
  });

  it("persists prayer preference updates and emits payload", async () => {
    await AsyncStorage.setItem(STORAGE_ENABLED, "1");

    const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

    const { result } = renderHook(() =>
      useNotificationPreferences({ notifStatus: null }),
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.enabled).toBe(true);
    });

    emitSpy.mockClear();

    await act(async () => {
      await result.current.setPrayerPreference("Fajr", false);
    });

    const storedMap = await AsyncStorage.getItem(STORAGE_MAP);
    expect(storedMap).not.toBeNull();
    expect(JSON.parse(storedMap || "{}")).toEqual(
      expect.objectContaining({ Fajr: false }),
    );

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      NOTIF_PREFS_UPDATED_EVENT,
      expect.objectContaining({
        enabled: true,
        soundMode: "default",
        prefs: expect.objectContaining({ Fajr: false }),
      }),
    );
  });

  it("updates sound mode and no-ops when selecting the same mode", async () => {
    await AsyncStorage.setItem(STORAGE_ENABLED, "1");

    const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

    const { result } = renderHook(() =>
      useNotificationPreferences({ notifStatus: null }),
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.enabled).toBe(true);
    });

    emitSpy.mockClear();

    await act(async () => {
      await result.current.updateSoundMode("default");
    });

    expect(result.current.soundMode).toBe("default");
    expect(await AsyncStorage.getItem(STORAGE_SOUND_MODE)).toBeNull();
    expect(emitSpy).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.updateSoundMode("adhan");
    });

    expect(result.current.soundMode).toBe("adhan");
    expect(await AsyncStorage.getItem(STORAGE_SOUND_MODE)).toBe("adhan");
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith(
      NOTIF_PREFS_UPDATED_EVENT,
      expect.objectContaining({
        enabled: true,
        soundMode: "adhan",
      }),
    );
  });

  it("hydrates window prefs and offset from storage", async () => {
    await AsyncStorage.multiSet([
      [STORAGE_ENABLED, "1"],
      [STORAGE_WINDOW_MAP, JSON.stringify({ Dhuhr: true, Sunrise: true })],
      [STORAGE_WINDOW_OFFSET, "20"],
    ]);

    const { result } = renderHook(() =>
      useNotificationPreferences({ notifStatus: null }),
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.windowPrefs).toEqual({
      ...DEFAULT_WINDOW_PREFS,
      Dhuhr: true,
    });
    expect(result.current.windowOffset).toBe(20);
  });

  it("persists window preference updates and emits payload", async () => {
    await AsyncStorage.setItem(STORAGE_ENABLED, "1");
    const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

    const { result } = renderHook(() =>
      useNotificationPreferences({ notifStatus: null }),
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.enabled).toBe(true);
    });

    emitSpy.mockClear();

    await act(async () => {
      await result.current.setWindowPreference("Asr", true);
    });

    expect(
      JSON.parse((await AsyncStorage.getItem(STORAGE_WINDOW_MAP)) || "{}"),
    ).toEqual(expect.objectContaining({ Asr: true }));
    expect(emitSpy).toHaveBeenCalledWith(
      NOTIF_PREFS_UPDATED_EVENT,
      expect.objectContaining({
        windowPrefs: expect.objectContaining({ Asr: true }),
      }),
    );

    emitSpy.mockClear();

    await act(async () => {
      await result.current.setWindowOffset(30);
    });

    expect(await AsyncStorage.getItem(STORAGE_WINDOW_OFFSET)).toBe("30");
    expect(result.current.windowOffset).toBe(30);
    expect(emitSpy).toHaveBeenCalledWith(
      NOTIF_PREFS_UPDATED_EVENT,
      expect.objectContaining({ windowOffset: 30 }),
    );
  });

  it("applies notifStatus overrides and persists emitted state", async () => {
    await AsyncStorage.setItem(STORAGE_ENABLED, "1");

    const emitSpy = jest.spyOn(DeviceEventEmitter, "emit");

    const { result, rerender } = renderHook(
      ({ notifStatus }: { notifStatus: string | null }) =>
        useNotificationPreferences({ notifStatus }),
      { initialProps: { notifStatus: null } },
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.enabled).toBe(true);
    });

    emitSpy.mockClear();

    rerender({ notifStatus: "denied" });

    await waitFor(() => {
      expect(result.current.enabled).toBe(false);
    });

    expect(await AsyncStorage.getItem(STORAGE_ENABLED)).toBe("0");
    expect(emitSpy).toHaveBeenCalledWith(
      NOTIF_PREFS_UPDATED_EVENT,
      expect.objectContaining({ enabled: false }),
    );

    emitSpy.mockClear();

    rerender({ notifStatus: "granted" });

    await waitFor(() => {
      expect(result.current.enabled).toBe(true);
    });

    expect(await AsyncStorage.getItem(STORAGE_ENABLED)).toBe("1");
    expect(emitSpy).toHaveBeenCalledWith(
      NOTIF_PREFS_UPDATED_EVENT,
      expect.objectContaining({ enabled: true }),
    );
  });
});
