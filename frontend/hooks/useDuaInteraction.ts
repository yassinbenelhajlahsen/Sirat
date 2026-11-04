import { getAnotherDua, requestDua, saveDuaToHistory, type Dua } from "@/services/duaService";
import { topicForCategory } from "@/services/duaTopics";
import { useCallback, useRef, useState } from "react";
import { Alert, Animated, Easing } from "react-native";

// The swap animates the wrapper around the cards. That is safe only while the
// cards stay solid: a Liquid Glass surface under an animated ancestor renders
// as nothing (the reason this was removed in 650a561).
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

  const showDua = useCallback(
    async (dua: Dua) => {
      await saveDuaToHistory(dua);
      runDuaTransition(dua);
    },
    [runDuaTransition],
  );

  const submitDua = useCallback(async (userRequest: string) => {
    try {
      setDuaLoading(true);
      const dua = await requestDua(userRequest);
      await showDua(dua);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message ?? "")
          : "";
      Alert.alert("Error", message || "Failed to find a dua");
    } finally {
      setDuaLoading(false);
    }
  }, [showDua]);

  const closeDua = useCallback(() => {
    runDuaTransition(null);
  }, [runDuaTransition]);

  const anotherDua = useCallback(() => {
    if (!selectedDua) return;
    const next = getAnotherDua(topicForCategory(selectedDua.category), selectedDua.id);
    if (next) {
      void showDua(next);
    }
  }, [selectedDua, showDua]);

  return {
    selectedDua,
    duaLoading,
    duaSwapAnim,
    submitDua,
    closeDua,
    anotherDua,
  };
}
