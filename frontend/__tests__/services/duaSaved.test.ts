import AsyncStorage from "@react-native-async-storage/async-storage";
import { duaSavedSetting } from "@/services/syncedSettings";
import {
  getSavedDuaIds,
  toggleSavedDua,
} from "@/services/duaSaved";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("services/duaSaved", () => {
  it("stamps and notifies on toggle", async () => {
    const listener = jest.fn();
    duaSavedSetting.subscribe(listener);
    await toggleSavedDua(1);
    expect(listener).toHaveBeenCalledWith([1], "local");
  });

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

  it("ignores corrupt storage", async () => {
    await AsyncStorage.setItem("dua_saved_v1", "{not json");
    expect(await getSavedDuaIds()).toEqual([]);
    await AsyncStorage.setItem("dua_saved_v1", JSON.stringify([2, "x", 2, null, 7]));
    expect(await getSavedDuaIds()).toEqual([2, 7]);
  });
});
