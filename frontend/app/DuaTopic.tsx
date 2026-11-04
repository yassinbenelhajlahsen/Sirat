import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView } from "react-native";

import DuaListSection from "@/components/duas/DuaListSection";
import Screen from "@/components/ui/Screen";
import { useTheme } from "@/context/ThemeContext";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { getDuasForTopic, type Dua } from "@/services/duaService";
import { getTopic } from "@/services/duaTopics";

export default function DuaTopic() {
  const { theme } = useTheme();
  const router = useRouter();
  const screenMargin = useScreenMargin();
  const { topic: topicId } = useLocalSearchParams<{ topic: string }>();

  const topic = getTopic(String(topicId));
  const duas = useMemo(() => (topic ? getDuasForTopic(topic.id) : []), [topic]);

  return (
    <Screen safeArea={false}>
      {topic ? <Stack.Screen options={{ title: topic.label }} /> : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: screenMargin, paddingBottom: theme.spacing.xxxl }}
      >
        <DuaListSection
          label={`${duas.length} ${duas.length === 1 ? "dua" : "duas"}`}
          duas={duas}
          onSelect={(dua: Dua) =>
            router.push({ pathname: "/DuaView", params: { id: String(dua.id) } })
          }
        />
      </ScrollView>
    </Screen>
  );
}
