// frontend/__tests__/hooks/useTrackingStats.test.ts
import { act, renderHook, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTrackingStats } from "@/hooks/useTrackingStats";
import { setPrayerStatus } from "@/services/prayerTracker";
import { dateKeyFromDate } from "@/services/holidayService";

describe("useTrackingStats", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("reflects a missed prayer in the qada count", async () => {
    const todayKey = dateKeyFromDate(new Date());
    const { result } = renderHook(() => useTrackingStats());
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current!.qada).toBe(0);
    await act(async () => {
      await setPrayerStatus(todayKey, "asr", "missed");
    });
    await waitFor(() => expect(result.current!.qada).toBe(1));
  });
});
