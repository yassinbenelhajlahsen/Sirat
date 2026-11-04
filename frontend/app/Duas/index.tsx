import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native";

import SettingsRow from "@/components/settings/SettingsRow";
import SettingsSection from "@/components/settings/SettingsSection";
import Screen from "@/components/ui/Screen";
import { useTheme } from "@/context/ThemeContext";
import { useSavedDuas } from "@/hooks/useSavedDuas";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { getDuasForTopic, getRecentDuas, type Dua } from "@/services/duaService";
import { DUA_TOPICS, DUA_TOPIC_GROUPS } from "@/services/duaTopics";

export default function Duas() {
  const { theme } = useTheme();
  const router = useRouter();
  const screenMargin = useScreenMargin();
  const { ids } = useSavedDuas();
  const [recent, setRecent] = useState<Dua[]>([]);

  useEffect(() => {
    void getRecentDuas().then(setRecent);
  }, []);

  const topicCounts = useMemo(
    () => Object.fromEntries(DUA_TOPICS.map((t) => [t.id, getDuasForTopic(t.id).length])),
    [],
  );

  const open = (list: string) => router.push({ pathname: "/Duas/[list]", params: { list } });

  return (
    <Screen safeArea={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: screenMargin, paddingBottom: theme.spacing.xxxl }}
      >
        <SettingsSection>
          <SettingsRow
            first
            icon="bookmark-outline"
            title="Saved"
            value={String(ids.length)}
            showChevron
            onPress={() => open("saved")}
            accessibilityLabel={`Saved, ${ids.length} duas`}
          />
          {recent.length > 0 ? (
            <SettingsRow
              icon="time-outline"
              title="Recent"
              value={String(recent.length)}
              showChevron
              onPress={() => open("recent")}
              accessibilityLabel={`Recent, ${recent.length} duas`}
            />
          ) : null}
        </SettingsSection>

        {DUA_TOPIC_GROUPS.map((group) => (
          <SettingsSection key={group} label={group}>
            {DUA_TOPICS.filter((t) => t.group === group).map((topic, index) => (
              <SettingsRow
                key={topic.id}
                first={index === 0}
                title={topic.label}
                value={String(topicCounts[topic.id])}
                showChevron
                onPress={() => open(topic.id)}
                accessibilityLabel={`${topic.label}, ${topicCounts[topic.id]} duas`}
              />
            ))}
          </SettingsSection>
        ))}
      </ScrollView>
    </Screen>
  );
}
