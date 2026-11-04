import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState, DeviceEventEmitter } from "react-native";

import { usePrayerDay } from "@/hooks/usePrayerDay";
import { usePrayerSettingsState } from "@/hooks/usePrayerSettingsState";
import { clearPrayerCache, getPrayerTimesToday } from "@/services/prayerTimes";
import { buildPrayerDay } from "@/services/prayerDay";
const dayOf = (rows: { label: string; time: string }[], date = new Date()) => buildPrayerDay(date, rows);

jest.mock("@/services/prayerTimes", () => ({
  clearPrayerCache: jest.fn(async () => {}),
  getPrayerTimesToday: jest.fn(),
}));

jest.mock("@/hooks/useNextPrayer", () => ({
  useNextPrayer: jest.fn(() => ({
    nextPrayer: { name: "Dhuhr", at: new Date(2026, 0, 1, 12) },
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

  it("persists changed settings and refreshes Home prayer times", async () => {
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));

    mockGetPrayerTimesToday.mockResolvedValue(dayOf([
      { label: "Fajr", time: "5:00 AM" },
      { label: "Dhuhr", time: "12:00 PM" },
      { label: "Isha", time: "8:00 PM" },
    ]));

    const { emitSpy } = wireDeviceEventEmitter();
    const setItemSpy = jest.spyOn(AsyncStorage, "setItem");

    const home = renderHook(() => usePrayerDay("today"));

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
    expect(home.result.current.error).toBeNull();
  });

  it("transitions from load success to refresh error and surfaces the fallback banner", async () => {
    freezeTestTime(new Date(2026, 1, 25, 9, 0, 0));

    const consoleWarnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    jest
      .spyOn(DeviceEventEmitter, "addListener")
      .mockImplementation((_eventName, _handler) => ({ remove: jest.fn() }) as any);

    mockGetPrayerTimesToday
      .mockResolvedValueOnce(dayOf([
        { label: "Fajr", time: "5:00 AM" },
        { label: "Dhuhr", time: "12:00 PM" },
      ]))
      .mockRejectedValueOnce(new Error("calendar upstream failed"));

    const { result } = renderHook(() => usePrayerDay("today"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetPrayerTimesToday).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.prayerDay).toBeNull();
    expect(result.current.error?.message).toContain("We could not load prayer times");
    expect(consoleWarnSpy).toHaveBeenCalled();
  });
});
