import { getAnotherDua, requestDua, saveDuaToHistory, type Dua } from "@/services/duaService";
import { topicForCategory } from "@/services/duaTopics";
import { useCallback, useState } from "react";
import { Alert } from "react-native";

/**
 * The dua card swap is un-animated because the cards used to be Liquid Glass,
 * which renders nothing under an animated ancestor. Cards are solid surfaces
 * now, so that limit no longer applies.
 */
export function useDuaInteraction() {
  const [selectedDua, setSelectedDua] = useState<Dua | null>(null);
  const [duaLoading, setDuaLoading] = useState(false);

  // Opens a known dua (library rows). History is written first so a Recent
  // list on screen already includes it when the dua appears.
  const showDua = useCallback(async (dua: Dua) => {
    await saveDuaToHistory(dua);
    setSelectedDua(dua);
  }, []);

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
    setSelectedDua(null);
  }, []);

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
    submitDua,
    showDua,
    closeDua,
    anotherDua,
  };
}
