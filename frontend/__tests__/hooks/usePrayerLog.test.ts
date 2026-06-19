import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePrayerLog } from "@/hooks/usePrayerLog";

describe("usePrayerLog", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("loads empty then reflects a set status", async () => {
    const { result } = renderHook(() => usePrayerLog("2026-06-19"));
    await waitFor(() => expect(result.current.statuses).toEqual({}));

    await act(async () => {
      await result.current.setStatus("fajr", "prayed");
    });
    await waitFor(() => expect(result.current.statuses.fajr).toBe("prayed"));
  });

  it("clears a status", async () => {
    const { result } = renderHook(() => usePrayerLog("2026-06-19"));
    await act(async () => {
      await result.current.setStatus("asr", "late");
    });
    await waitFor(() => expect(result.current.statuses.asr).toBe("late"));
    await act(async () => {
      await result.current.clearStatus("asr");
    });
    await waitFor(() => expect(result.current.statuses.asr).toBeUndefined());
  });
});
