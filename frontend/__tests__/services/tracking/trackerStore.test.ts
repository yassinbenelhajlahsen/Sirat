import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import { createTrackerStore, isRecord } from "@/services/tracking/trackerStore";

const make = () =>
  createTrackerStore<Record<string, number>>({
    storageKey: "test:store",
    event: "TEST_STORE_UPDATED",
    empty: () => ({}),
    parse: (raw) => (isRecord(raw) ? (raw as Record<string, number>) : {}),
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe("trackerStore", () => {
  it("is empty before the first read and loads stored data once", async () => {
    await AsyncStorage.setItem("test:store", JSON.stringify({ a: 1 }));
    const store = make();
    expect(store.peek()).toEqual({});
    const getItem = jest.spyOn(AsyncStorage, "getItem");
    getItem.mockClear();

    const [x, y] = await Promise.all([store.get(), store.get()]);

    expect(x).toEqual({ a: 1 });
    expect(y).toBe(x);
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(store.peek()).toEqual({ a: 1 });
  });

  it("falls back to empty for malformed or wrongly shaped storage", async () => {
    await AsyncStorage.setItem("test:store", "not-json");
    expect(await make().get()).toEqual({});
    await AsyncStorage.setItem("test:store", "[1,2]");
    expect(await make().get()).toEqual({});
  });

  it("save persists, updates the cache and notifies subscribers with the change", async () => {
    const store = make();
    const listener = jest.fn();
    const off = store.subscribe(listener);

    await store.save({ a: 2 }, { dateKey: "2026-06-19" });

    expect(JSON.parse((await AsyncStorage.getItem("test:store"))!)).toEqual({ a: 2 });
    expect(store.peek()).toEqual({ a: 2 });
    expect(listener).toHaveBeenCalledWith({ dateKey: "2026-06-19" });

    await store.save({ a: 3 });
    expect(listener).toHaveBeenLastCalledWith({});
    off();
    await store.save({ a: 4 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("emits the bare event when there is no change payload", async () => {
    const emit = jest.spyOn(DeviceEventEmitter, "emit");
    await make().save({});
    expect(emit).toHaveBeenCalledWith("TEST_STORE_UPDATED");
  });

  it("keeps the in-memory value when persisting fails", async () => {
    const store = make();
    jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("full"));
    await store.save({ a: 9 });
    expect(await store.get()).toEqual({ a: 9 });
  });
});
