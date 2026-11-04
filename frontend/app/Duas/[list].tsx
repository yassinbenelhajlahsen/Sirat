import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import DuaEntry from "@/components/duas/DuaEntry";
import Screen from "@/components/ui/Screen";
import { Footnote } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useSavedDuas } from "@/hooks/useSavedDuas";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { getDuaById, getDuasForTopic, getRecentDuas, type Dua } from "@/services/duaService";
import { getTopic } from "@/services/duaTopics";

/** Every dua in a topic, in Saved or in Recent, shown in full so nothing needs another tap. */
export default function DuaList() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screenMargin = useScreenMargin();
  const { list } = useLocalSearchParams<{ list: string }>();
  const { ids } = useSavedDuas();
  const [recent, setRecent] = useState<Dua[]>([]);

  useEffect(() => {
    if (list === "recent") void getRecentDuas().then(setRecent);
  }, [list]);

  const topic = getTopic(String(list));
  const title = list === "saved" ? "Saved" : list === "recent" ? "Recent" : topic?.label ?? "Duas";
  const duas = useMemo(() => {
    if (list === "saved") return ids.map(getDuaById).filter((d): d is Dua => d !== null);
    if (list === "recent") return recent;
    return topic ? getDuasForTopic(topic.id) : [];
  }, [list, ids, recent, topic]);

  return (
    <Screen safeArea={false}>
      <Stack.Screen options={{ title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: screenMargin, paddingBottom: theme.spacing.xxxl }}
      >
        {duas.length === 0 ? (
          <Footnote color={theme.colors.textSecondary} style={styles.empty}>
            {list === "saved" ? "Tap the bookmark on a dua to keep it here." : "No duas here yet."}
          </Footnote>
        ) : (
          <View style={styles.list}>
            {duas.map((dua) => (
              <DuaEntry key={dua.id} dua={dua} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    list: { gap: theme.spacing.md, marginTop: theme.spacing.md },
    empty: { textAlign: "center", marginTop: theme.spacing.xxl },
  });
