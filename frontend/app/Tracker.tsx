// frontend/app/Tracker.tsx
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CompletionRings from "@/components/tracking/CompletionRings";
import HabitEditor from "@/components/tracking/HabitEditor";
import HabitRow from "@/components/tracking/HabitRow";
import MonthHeatmap from "@/components/tracking/MonthHeatmap";
import QadaCard from "@/components/tracking/QadaCard";
import StreakHero from "@/components/tracking/StreakHero";
import GlassSurface from "@/components/ui/GlassSurface";
import Screen from "@/components/ui/Screen";
import ScreenHeader from "@/components/ui/ScreenHeader";
import SectionHeader from "@/components/ui/SectionHeader";
import { Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { useHabitLog, useHabitLogAll } from "@/hooks/useHabitLog";
import { useHabits } from "@/hooks/useHabits";
import { useTrackingStats } from "@/hooks/useTrackingStats";
import { habitStreak, type Habit } from "@/services/habitTracker";
import { dateKeyFromDate } from "@/services/holidayService";
import { isHabitDueOnDate } from "@/utils/habitFrequency";

export default function Tracker() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const screenMargin = useScreenMargin();
  const router = useRouter();

  const stats = useTrackingStats();
  const { habits, create, update, archive, remove, reorder } = useHabits();
  const allDone = useHabitLogAll();
  const today = new Date();
  const todayKey = dateKeyFromDate(today);
  const { done: doneToday, toggle: toggleToday } = useHabitLog(todayKey);

  const [editing, setEditing] = useState<{ open: boolean; habit: Habit | null }>({
    open: false,
    habit: null,
  });

  const move = (index: number, delta: number) => {
    const ids = habits.map((h) => h.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void reorder(ids);
  };

  // Archiving has no undo surface in the UI, so it gets a confirmation.
  const confirmArchive = useCallback(
    (habit: Habit) => {
      Alert.alert(
        "Archive habit?",
        `"${habit.name}" will leave your tracker. Its history is kept.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Archive", style: "destructive", onPress: () => void archive(habit.id) },
        ],
      );
    },
    [archive],
  );

  return (
    <Screen safeArea={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingHorizontal: screenMargin },
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <ScreenHeader
          title="Tracker"
          leadingIcon="chevron-back"
          onLeadingPress={() => router.back()}
          leadingAccessibilityLabel="Go back"
        />

        <View style={styles.streakSlot}>
          <StreakHero streak={stats?.streak ?? 0} />
        </View>

        <View style={styles.section}>
          <SectionHeader title="This month" />
          <GlassSurface tier="card" radius={theme.radii.card} style={styles.monthCard}>
            <CompletionRings byPrayer={stats?.completion.byPrayer ?? EMPTY_BY_PRAYER} />
            <View style={styles.hairline} />
            {stats ? (
              <>
                <MonthHeatmap scores={stats.dailyScores} year={stats.year} monthIndex0={stats.monthIndex0} />
                <View style={styles.hairline} />
              </>
            ) : null}
            <QadaCard count={stats?.qada ?? 0} />
          </GlassSurface>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Habits"
            actionLabel="+ New"
            onActionPress={() => setEditing({ open: true, habit: null })}
            actionAccessibilityLabel="New habit"
          />
          {habits.length === 0 ? (
            <Footnote color={colors.textTertiary} style={styles.empty}>
              No habits yet. Tap &quot;+ New&quot; to start.
            </Footnote>
          ) : (
            <GlassSurface tier="row" radius={theme.radii.row} style={styles.habitList}>
              {habits.map((habit, index) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  streak={habitStreak(habit, allDone, habit.id, todayKey)}
                  dueToday={isHabitDueOnDate(habit.frequency, today)}
                  doneToday={!!doneToday[habit.id]}
                  onToggleToday={() => void toggleToday(habit.id)}
                  canMoveUp={index > 0}
                  canMoveDown={index < habits.length - 1}
                  onMoveUp={() => move(index, -1)}
                  onMoveDown={() => move(index, 1)}
                  onEdit={() => setEditing({ open: true, habit })}
                  onArchive={() => confirmArchive(habit)}
                  separated={index > 0}
                />
              ))}
            </GlassSurface>
          )}
        </View>
      </ScrollView>

      <HabitEditor
        visible={editing.open}
        initial={editing.habit}
        onSubmit={(input) => {
          if (editing.habit) void update(editing.habit.id, input);
          else void create(input);
        }}
        onDelete={editing.habit ? () => void remove(editing.habit!.id) : undefined}
        onClose={() => setEditing({ open: false, habit: null })}
      />
    </Screen>
  );
}

const EMPTY_BY_PRAYER = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    streakSlot: { marginTop: spacing.lg },
    section: { marginTop: spacing.xxl },
    monthCard: { padding: spacing.lg, gap: spacing.lg },
    hairline: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: withOpacity(colors.white, 0.1),
    },
    habitList: { paddingHorizontal: spacing.md },
    empty: { paddingVertical: spacing.xl, textAlign: "center" },
  });
};
