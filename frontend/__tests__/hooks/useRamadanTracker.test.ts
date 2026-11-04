import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook } from "@testing-library/react-native";

import { useRamadanTracker } from "@/hooks/useRamadanTracker";

describe("hooks/useRamadanTracker", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("allows marking on a Ramadan day and toggles the missed fast", async () => {
    const selectedDate = new Date(2026, 1, 28); // Ramadan 1447

    const { result } = renderHook(() => useRamadanTracker(selectedDate));
    await act(async () => {});
    expect(result.current.isRamadan).toBe(true);
    expect(result.current.isFastMissed).toBe(false);

    await act(async () => {
      await result.current.toggleMissedFast();
    });
    expect(result.current.isFastMissed).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem("ramadan_tracker_v1"))!)).toEqual({ "2026-02-28": true });

    await act(async () => {
      await result.current.toggleMissedFast();
    });
    expect(result.current.isFastMissed).toBe(false);
  });

  it("allows the 3 days either side of Ramadan but not further out", async () => {
    const edge = renderHook(() => useRamadanTracker(new Date(2026, 1, 15)));
    const outside = renderHook(() => useRamadanTracker(new Date(2026, 1, 14)));
    await act(async () => {});
    expect(edge.result.current.isRamadan).toBe(true);
    expect(outside.result.current.isRamadan).toBe(false);
  });

  it("does nothing without a date", async () => {
    const { result } = renderHook(() => useRamadanTracker(null));
    await act(async () => {});
    expect(result.current.isRamadan).toBe(false);
  });
});
