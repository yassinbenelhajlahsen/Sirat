import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState, DeviceEventEmitter } from "react-native";

import { useHomePrayerTimes } from "@/hooks/useHomePrayerTimes";
import { usePrayerSettingsState } from "@/hooks/usePrayerSettingsState";
import { clearPrayerCache, getPrayerTimesToday } from "@/services/prayerTimes";

jest.mock("@/services/prayerTimes", () => ({
  clearPrayerCache: jest.fn(async () => {}),
  getPrayerTimesToday: jest.fn(),
}));

jest.mock("@/hooks/useNextPrayer", () => ({
  useNextPrayer: jest.fn(() => ({
    nextPrayer: { label: "Dhuhr", time: "12:00 PM" },
    timeLeft: "3h",
  })),
}));

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

const mockGetPrayerTimesToday = getPrayerTimesToday as jest.MockedFunction<
  typeof getPrayerTimesToday
>;
const mockClearPrayerCache = clearPrayerCache as jest.MockedFunction<
  typeof clearPrayerCache
>;

describe("flows/home-settings-refresh", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();

    await AsyncStorage.setItem(
      "prayerSettings",
      JSON.stringify({
        useLocation: false,
        method: 2,
        city: {
          name: "Chicago",
          country: "US",
          lat: 41.88,
          lng: -87.63,
        },
      }),
    );

    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, _handler) => ({ remove: jest.fn() }) as any);
  });

  afterEach(() => {
    resetTestTime();
    jest.restoreAllMocks();
  });

  it("persists changed settings, emits settingsChanged, and refreshes Home prayer times", async () => {
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));

    mockGetPrayerTimesToday.mockResolvedValue([
      { label: "Fajr", time: "5:00 AM" },
      { label: "Dhuhr", time: "12:00 PM" },
      { label: "Isha", time: "8:00 PM" },
    ] as any);

    const { emitSpy } = wireDeviceEventEmitter();
    const setItemSpy = jest.spyOn(AsyncStorage, "setItem");

    const home = renderHook(() => useHomePrayerTimes());

    await waitFor(() => {
      expect(home.result.current.loading).toBe(false);
      expect(home.result.current.locationLabel).toBe("Chicago");
    });

    const settings = renderHook(() => usePrayerSettingsState());

    await waitFor(() => {
      expect(settings.result.current.method).toBe(2);
    });

    mockGetPrayerTimesToday.mockClear();
    mockClearPrayerCache.mockClear();
    emitSpy.mockClear();
    setItemSpy.mockClear();

    act(() => {
      settings.result.current.setMethod(5);
    });

    await waitFor(() => {
      expect(setItemSpy).toHaveBeenCalledWith(
        "prayerSettings",
        expect.stringContaining('"method":5'),
      );
      expect(mockClearPrayerCache).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith(
        "settingsChanged",
        expect.objectContaining({ method: 5 }),
      );
      expect(mockGetPrayerTimesToday).toHaveBeenCalledTimes(1);
    });

    const lastSettings = mockGetPrayerTimesToday.mock.calls.at(-1)?.[0];
    expect(lastSettings).toEqual(
      expect.objectContaining({
        useLocation: false,
        method: 5,
      }),
    );
    expect(home.result.current.loading).toBe(false);
    expect(home.result.current.banner).toBe("");
  });

  it("transitions from load success to refresh error and surfaces the fallback banner", async () => {
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    jest
      .spyOn(DeviceEventEmitter, "addListener")
      .mockImplementation((_eventName, _handler) => ({ remove: jest.fn() }) as any);

    mockGetPrayerTimesToday
      .mockResolvedValueOnce([
        { label: "Fajr", time: "5:00 AM" },
        { label: "Dhuhr", time: "12:00 PM" },
      ] as any)
      .mockRejectedValueOnce(new Error("calendar upstream failed"));

    const { result } = renderHook(() => useHomePrayerTimes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.banner).toBe("");
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetPrayerTimesToday).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.prayerTimes).toEqual([]);
    expect(result.current.banner).toContain("We could not load prayer times");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
