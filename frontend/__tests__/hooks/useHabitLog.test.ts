// frontend/__tests__/hooks/useHabitLog.test.ts
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useHabitLog, useHabitLogAll } from "@/hooks/useHabitLog";

describe("useHabitLog", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("toggles a habit done for a day", async () => {
    const { result } = renderHook(() => useHabitLog("2026-06-19"));
    await waitFor(() => expect(result.current.done).toEqual({}));
    await act(async () => {
      await result.current.toggle("h1");
    });
    await waitFor(() => expect(result.current.done.h1).toBe(true));
    await act(async () => {
      await result.current.toggle("h1");
    });
    await waitFor(() => expect(result.current.done.h1).toBe(false));
  });

  it("useHabitLogAll exposes the full unwrapped log", async () => {
    const { result: log } = renderHook(() => useHabitLog("2026-06-20"));
    await act(async () => {
      await log.current.toggle("h2");
    });
    const { result: all } = renderHook(() => useHabitLogAll());
    await waitFor(() => expect(all.current["2026-06-20"]?.h2).toBe(true));
  });
});
