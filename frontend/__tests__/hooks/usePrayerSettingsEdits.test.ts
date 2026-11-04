import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { usePrayerSettingsState } from "@/hooks/usePrayerSettingsState";
import { prayerSettingsSetting } from "@/services/syncedSettings";

jest.mock("@/services/prayerTimes", () => ({ clearPrayerCache: jest.fn(async () => {}) }));

const chicago = { name: "Chicago", country: "US", lat: 41.88, lng: -87.63 };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("usePrayerSettingsState", () => {
  it("shows the saved settings without saving anything on load", async () => {
    await AsyncStorage.setItem("prayerSettings", JSON.stringify({ useLocation: false, method: 4, city: chicago }));
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    setItem.mockClear();

    const { result } = renderHook(() => usePrayerSettingsState());

    await waitFor(() => expect(result.current.method).toBe(4));
    expect(result.current.useLocation).toBe(false);
    expect(result.current.city).toEqual(chicago);
    expect(setItem).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem("sync:settings_meta_v1")).toBeNull();
  });

  it("saves and stamps a real edit, keeping the other fields", async () => {
    await AsyncStorage.setItem("prayerSettings", JSON.stringify({ useLocation: false, method: 4, city: chicago }));
    const { result } = renderHook(() => usePrayerSettingsState());
    await waitFor(() => expect(result.current.method).toBe(4));

    await act(async () => {
      result.current.setMethod(7);
    });

    await waitFor(async () => expect((await prayerSettingsSetting.get()).method).toBe(7));
    expect(await prayerSettingsSetting.get()).toMatchObject({ useLocation: false, city: chicago });
    expect(JSON.parse((await AsyncStorage.getItem("sync:settings_meta_v1"))!).prayerSettings).toBeGreaterThan(0);
  });

  it("follows a change synced in from another device", async () => {
    const { result } = renderHook(() => usePrayerSettingsState());
    await act(async () => {
      await prayerSettingsSetting.applyRemote({ useLocation: false, method: 9, city: chicago });
    });
    expect(result.current.method).toBe(9);
    expect(result.current.useLocation).toBe(false);
  });
});
