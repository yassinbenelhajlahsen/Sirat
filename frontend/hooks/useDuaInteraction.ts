import { requestDua, saveDuaToHistory, type Dua } from "@/services/duaService";
import { useCallback, useRef, useState } from "react";
import { Alert, Animated, Easing } from "react-native";

export function useDuaInteraction() {
  const [selectedDua, setSelectedDua] = useState<Dua | null>(null);
  const [duaLoading, setDuaLoading] = useState(false);
  const duaSwapAnim = useRef(new Animated.Value(1)).current;

  const runDuaTransition = useCallback(
    (nextDua: Dua | null) => {
      Animated.timing(duaSwapAnim, {
        toValue: 0,
        duration: 170,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setSelectedDua(nextDua);
        duaSwapAnim.setValue(0);
        Animated.spring(duaSwapAnim, {
          toValue: 1,
          speed: 15,
          bounciness: 10,
          useNativeDriver: true,
        }).start();
      });
    },
    [duaSwapAnim],
  );

  const submitDua = useCallback(
    async (userRequest: string) => {
      try {
        setDuaLoading(true);
        const dua = await requestDua(userRequest);
        runDuaTransition(dua);
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
    },
    [runDuaTransition],
  );

  const closeDua = useCallback(() => {
    runDuaTransition(null);
  }, [runDuaTransition]);

  return {
    selectedDua,
    duaLoading,
    duaSwapAnim,
    submitDua,
    closeDua,
  };
}
