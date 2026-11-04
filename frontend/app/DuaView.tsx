import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ScrollView } from "react-native";

import DuaResultCard from "@/components/DuaResultCard";
import Screen from "@/components/ui/Screen";
import { useTheme } from "@/context/ThemeContext";
import { useDuaInteraction } from "@/hooks/useDuaInteraction";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { getDuaById } from "@/services/duaService";

export default function DuaView() {
  const { theme } = useTheme();
  const router = useRouter();
  const screenMargin = useScreenMargin();
  const { id } = useLocalSearchParams<{ id: string }>();

  const initial = getDuaById(Number(id));
  const { selectedDua, showDua, anotherDua } = useDuaInteraction();
  const dua = selectedDua ?? initial;

  useEffect(() => {
    if (initial) void showDua(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id, showDua]);

  if (!dua) return null;

  return (
    <Screen safeArea={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: screenMargin, paddingBottom: theme.spacing.xxxl }}
      >
        <DuaResultCard dua={dua} onClose={() => router.back()} onAnother={anotherDua} />
      </ScrollView>
    </Screen>
  );
}
