import { getAnotherDua, requestDua, saveDuaToHistory, type Dua } from "@/services/duaService";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

/**
 * The dua card swap is deliberately un-animated.
 *
 * Both cards are `GlassSurface`, and iOS Liquid Glass samples what is behind it
 * through its own layer — it cannot do that under an animated ancestor. A
 * GlassView mounted beneath either group opacity *or* a non-identity transform
 * renders as nothing, and it does not recover once the animation settles. So a
 * crossfade here costs the arriving card its container permanently, which is
 * the bug this replaced: close a dua result and the "Ask for a dua" card came
 * back with its content sitting straight on the gradient.
 *
 * If the motion is wanted back, it has to move *inside* each card — the glass
 * container static, its contents fading — never onto the wrapper.
 */
export function useDuaInteraction() {
  const [selectedDua, setSelectedDua] = useState<Dua | null>(null);
  const [duaLoading, setDuaLoading] = useState(false);

  const submitDua = useCallback(async (userRequest: string) => {
    try {
      setDuaLoading(true);
      const dua = await requestDua(userRequest);
      setSelectedDua(dua);
      await saveDuaToHistory(dua);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message ?? "")
          : "";
      Alert.alert("Error", message || "Failed to find a dua");
    } finally {
      setDuaLoading(false);
    }
  }, []);

  const closeDua = useCallback(() => {
    setSelectedDua(null);
  }, []);

  const anotherDua = useCallback(() => {
    if (!selectedDua) return;
    const next = getAnotherDua(selectedDua.category, selectedDua.id);
    if (next) {
      setSelectedDua(next);
    }
  }, [selectedDua]);

  return {
    selectedDua,
    duaLoading,
    submitDua,
    closeDua,
    anotherDua,
  };
}
