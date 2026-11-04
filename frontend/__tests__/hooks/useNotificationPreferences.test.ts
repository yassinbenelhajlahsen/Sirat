import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { DeviceEventEmitter } from "react-native";

import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { subscribeMasterEnabled } from "@/services/notifications/storage";
import { getSettingsMeta } from "@/services/sync/settingsMeta";
import {
  DEFAULT_PREFS,
  DEFAULT_WINDOW_PREFS,
  STORAGE_ENABLED,
  STORAGE_FRIDAY,
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

  it("persists and stamps prayer preference updates", async () => {
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

    expect((await getSettingsMeta()).notifPrefs).toBeGreaterThan(0);
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
    expect((await getSettingsMeta()).notifSoundMode).toBeUndefined();

    await act(async () => {
      await result.current.updateSoundMode("adhan");
    });

    expect(result.current.soundMode).toBe("adhan");
    expect(await AsyncStorage.getItem(STORAGE_SOUND_MODE)).toBe("adhan");
    expect((await getSettingsMeta()).notifSoundMode).toBeGreaterThan(0);
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

  it("persists and stamps window preference updates", async () => {
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
    expect((await getSettingsMeta()).notifWindowMap).toBeGreaterThan(0);

    emitSpy.mockClear();

    await act(async () => {
      await result.current.setWindowOffset(30);
    });

    expect(await AsyncStorage.getItem(STORAGE_WINDOW_OFFSET)).toBe("30");
    expect(result.current.windowOffset).toBe(30);
    expect((await getSettingsMeta()).notifWindowOffset).toBeGreaterThan(0);
  });

  it("defaults the Friday reminder to on, and restores a stored off", async () => {
    const first = renderHook(() =>
      useNotificationPreferences({ notifStatus: null }),
    );
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    expect(first.result.current.fridayEnabled).toBe(true);
    first.unmount();

    await AsyncStorage.setItem(STORAGE_FRIDAY, "0");
    const second = renderHook(() =>
      useNotificationPreferences({ notifStatus: null }),
    );
    await waitFor(() => expect(second.result.current.loaded).toBe(true));
    expect(second.result.current.fridayEnabled).toBe(false);
  });

  it("persists and stamps the Friday reminder", async () => {
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
      await result.current.setFridayEnabled(false);
    });

    expect(await AsyncStorage.getItem(STORAGE_FRIDAY)).toBe("0");
    expect(result.current.fridayEnabled).toBe(false);
    expect((await getSettingsMeta()).notifFriday).toBeGreaterThan(0);
    const stampedAt = (await getSettingsMeta()).notifFriday;

    await act(async () => {
      await result.current.setFridayEnabled(false);
    });
    expect((await getSettingsMeta()).notifFriday).toBe(stampedAt);
  });

  it("applies notifStatus overrides, persists them, and announces only real changes", async () => {
    await AsyncStorage.setItem(STORAGE_ENABLED, "1");

    const changes = jest.fn();
    const off = subscribeMasterEnabled(changes);

    const { result, rerender } = renderHook(
      ({ notifStatus }: { notifStatus: string | null }) =>
        useNotificationPreferences({ notifStatus }),
      { initialProps: { notifStatus: null } },
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.enabled).toBe(true);
    });

    expect(changes).not.toHaveBeenCalled();

    rerender({ notifStatus: "denied" });

    await waitFor(() => {
      expect(result.current.enabled).toBe(false);
    });

    expect(await AsyncStorage.getItem(STORAGE_ENABLED)).toBe("0");
    expect(changes).toHaveBeenLastCalledWith(false);

    rerender({ notifStatus: "granted" });

    await waitFor(() => {
      expect(result.current.enabled).toBe(true);
    });

    expect(await AsyncStorage.getItem(STORAGE_ENABLED)).toBe("1");
    expect(changes).toHaveBeenLastCalledWith(true);
    expect(changes).toHaveBeenCalledTimes(2);
    off();
  });
});
