import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import DuaCard from "@/components/DuaCard";
import DuaResultCard from "@/components/DuaResultCard";
import DuaListSection from "@/components/duas/DuaListSection";
import SettingsRow from "@/components/settings/SettingsRow";
import SettingsSection from "@/components/settings/SettingsSection";
import Screen from "@/components/ui/Screen";
import { Footnote } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useDuaInteraction } from "@/hooks/useDuaInteraction";
import { useSavedDuas } from "@/hooks/useSavedDuas";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { getDuaById, getDuasForTopic, getRecentDuas, type Dua } from "@/services/duaService";
import { DUA_TOPICS, DUA_TOPIC_GROUPS } from "@/services/duaTopics";

export default function Duas() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const screenMargin = useScreenMargin();

  const { selectedDua, duaLoading, submitDua, closeDua, anotherDua } = useDuaInteraction();
  const { ids } = useSavedDuas();
  const [recent, setRecent] = useState<Dua[]>([]);

  // Re-read when an ask result appears or closes: history is written before it shows.
  useEffect(() => {
    void getRecentDuas().then(setRecent);
  }, [selectedDua]);

  const saved = useMemo(
    () => ids.map(getDuaById).filter((dua): dua is Dua => dua !== null),
    [ids],
  );
  const topicCounts = useMemo(
    () => Object.fromEntries(DUA_TOPICS.map((t) => [t.id, getDuasForTopic(t.id).length])),
    [],
  );

  const openDua = (dua: Dua) =>
    router.push({ pathname: "/DuaView", params: { id: String(dua.id) } });

  return (
    <Screen safeArea={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: screenMargin, paddingBottom: theme.spacing.xxxl }}
      >
        <View style={styles.ask}>
          {selectedDua ? (
            <DuaResultCard dua={selectedDua} onClose={closeDua} onAnother={anotherDua} />
          ) : (
            <DuaCard onSubmit={submitDua} loading={duaLoading} />
          )}
        </View>

        {saved.length > 0 ? (
          <DuaListSection label="Saved" duas={saved} onSelect={openDua} />
        ) : (
          <SettingsSection label="Saved">
            <Footnote color={theme.colors.textSecondary} style={styles.empty}>
              Tap the bookmark on a dua to keep it here.
            </Footnote>
          </SettingsSection>
        )}

        {recent.length > 0 ? (
          <DuaListSection label="Recent" duas={recent} onSelect={openDua} />
        ) : null}

        {DUA_TOPIC_GROUPS.map((group) => (
          <SettingsSection key={group} label={group}>
            {DUA_TOPICS.filter((t) => t.group === group).map((topic, index) => (
              <SettingsRow
                key={topic.id}
                first={index === 0}
                title={topic.label}
                value={String(topicCounts[topic.id])}
                showChevron
                onPress={() =>
                  router.push({ pathname: "/DuaTopic", params: { topic: topic.id } })
                }
                accessibilityLabel={`${topic.label}, ${topicCounts[topic.id]} duas`}
              />
            ))}
          </SettingsSection>
        ))}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    ask: { marginTop: theme.spacing.md },
    empty: { padding: theme.spacing.lg },
  });
