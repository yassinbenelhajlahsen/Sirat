import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useSyncedSetting } from "@/hooks/useSyncedSetting";
import { notifSoundModeSetting } from "@/services/syncedSettings";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("useSyncedSetting", () => {
  it("loads the stored value", async () => {
    await AsyncStorage.setItem("notif_sound_mode_v1", "adhan");
    const { result } = renderHook(() => useSyncedSetting(notifSoundModeSetting));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.value).toBe("adhan");
  });

  it("keeps a change that arrives while the first read is still in flight", async () => {
    const { result } = renderHook(() => useSyncedSetting(notifSoundModeSetting));
    await act(async () => {
      await notifSoundModeSetting.applyRemote("adhan");
    });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.value).toBe("adhan");
  });
});
