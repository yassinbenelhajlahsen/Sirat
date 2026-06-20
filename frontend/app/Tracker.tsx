// frontend/app/Tracker.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "@/components/PressableScale";
import CompletionRings from "@/components/tracking/CompletionRings";
import HabitEditor from "@/components/tracking/HabitEditor";
import HabitRow from "@/components/tracking/HabitRow";
import MonthHeatmap from "@/components/tracking/MonthHeatmap";
import QadaCard from "@/components/tracking/QadaCard";
import StreakHero from "@/components/tracking/StreakHero";
import Screen from "@/components/ui/Screen";
import { Caption, LargeTitle, Title2 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
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

  return (
    <Screen safeArea={false}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={styles.headerRow}>
          <PressableScale
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </PressableScale>
          <LargeTitle>Tracker</LargeTitle>
        </View>

        <View style={styles.section}>
          <StreakHero streak={stats?.streak ?? 0} />
          <CompletionRings byPrayer={stats?.completion.byPrayer ?? EMPTY_BY_PRAYER} />
          {stats ? (
            <MonthHeatmap scores={stats.dailyScores} year={stats.year} monthIndex0={stats.monthIndex0} />
          ) : null}
          <QadaCard count={stats?.qada ?? 0} />
        </View>

        <View style={styles.habitsHeader}>
          <Title2>Habits</Title2>
          <PressableScale
            onPress={() => setEditing({ open: true, habit: null })}
            accessibilityRole="button"
            accessibilityLabel="New habit"
            style={styles.newBtn}
          >
            <Ionicons name="add" size={18} color={colors.onAccent} />
            <Caption color={colors.onAccent} style={styles.newBtnText}>New habit</Caption>
          </PressableScale>
        </View>

        {habits.length === 0 ? (
          <Caption color={withOpacity(colors.white, 0.6)} style={styles.empty}>
            No habits yet. Tap &quot;New habit&quot; to start.
          </Caption>
        ) : (
          <View style={styles.habitList}>
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
                onArchive={() => void archive(habit.id)}
              />
            ))}
          </View>
        )}
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
    content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
    headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    backBtn: { padding: spacing.xs, marginLeft: -spacing.xs },
    section: { gap: spacing.md },
    habitsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: theme.radii.pill,
    },
    newBtnText: { fontWeight: "700" },
    habitList: { gap: spacing.sm },
    empty: { paddingVertical: spacing.xl, textAlign: "center" },
  });
};
