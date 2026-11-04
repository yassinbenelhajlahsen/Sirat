import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useTrackerData } from "@/hooks/useTrackerData";
import { createTrackerStore, isRecord } from "@/services/tracking/trackerStore";

const store = createTrackerStore<Record<string, number>>({
  storageKey: "test:hook",
  event: "TEST_HOOK_UPDATED",
  empty: () => ({}),
  parse: (raw) => (isRecord(raw) ? (raw as Record<string, number>) : {}),
});
const total = (data: Record<string, number>) => Object.values(data).reduce((a, b) => a + b, 0);

beforeEach(async () => {
  await AsyncStorage.clear();
  await store.save({});
});

describe("useTrackerData", () => {
  it("loads, then follows changes", async () => {
    const { result } = renderHook(() => useTrackerData(store, total, -1));
    await waitFor(() => expect(result.current).toBe(0));

    await act(async () => {
      await store.save({ a: 2, b: 3 }, { dateKey: "2026-06-19" });
    });
    expect(result.current).toBe(5);
  });

  it("ignores changes to other days but reloads on a day-less change from sync", async () => {
    const { result } = renderHook(() => useTrackerData(store, total, -1, "2026-06-19"));
    await waitFor(() => expect(result.current).toBe(0));

    await act(async () => {
      await store.save({ a: 4 }, { dateKey: "2026-06-20" });
    });
    expect(result.current).toBe(0);

    await act(async () => {
      await store.save({ a: 4 }, { dateKey: null });
    });
    expect(result.current).toBe(4);
  });

  it("stops listening when unmounted", async () => {
    const { result, unmount } = renderHook(() => useTrackerData(store, total, -1));
    await waitFor(() => expect(result.current).toBe(0));
    unmount();
    await act(async () => {
      await store.save({ a: 1 });
    });
    expect(result.current).toBe(0);
  });
});
