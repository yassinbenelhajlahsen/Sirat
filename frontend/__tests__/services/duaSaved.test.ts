import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import {
  DUA_SAVED_UPDATED_EVENT,
  getSavedDuaIds,
  replaceSavedDuaIds,
  toggleSavedDua,
} from "@/services/duaSaved";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("services/duaSaved", () => {
  it("starts empty", async () => {
    expect(await getSavedDuaIds()).toEqual([]);
  });

  it("saves newest first and removes on a second toggle", async () => {
    expect(await toggleSavedDua(3)).toBe(true);
    expect(await toggleSavedDua(9)).toBe(true);
    expect(await getSavedDuaIds()).toEqual([9, 3]);

    expect(await toggleSavedDua(9)).toBe(false);
    expect(await getSavedDuaIds()).toEqual([3]);
  });

  it("emits its own change event for toggles and sync writes", async () => {
    const listener = jest.fn();
    const sub = DeviceEventEmitter.addListener(DUA_SAVED_UPDATED_EVENT, listener);

    await toggleSavedDua(1);
    await replaceSavedDuaIds([5, 4]);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(await getSavedDuaIds()).toEqual([5, 4]);
    sub.remove();
  });

  it("ignores corrupt storage", async () => {
    await AsyncStorage.setItem("dua_saved_v1", "{not json");
    expect(await getSavedDuaIds()).toEqual([]);
    await AsyncStorage.setItem("dua_saved_v1", JSON.stringify([2, "x", 2, null, 7]));
    expect(await getSavedDuaIds()).toEqual([2, 7]);
  });
});
