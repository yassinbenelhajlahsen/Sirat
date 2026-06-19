import { renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useHaptics } from "@/hooks/useHaptics";

describe("useHaptics", () => {
  it("maps each event to the right expo-haptics call", () => {
    const { result } = renderHook(() => useHaptics());
    const haptic = result.current;

    haptic("selection");
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);

    haptic("light");
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);

    haptic("medium");
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);

    haptic("success");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);

    haptic("error");
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it("never throws if a native call rejects", () => {
    (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error("no haptics"));
    const { result } = renderHook(() => useHaptics());
    expect(() => result.current("selection")).not.toThrow();
  });
});
