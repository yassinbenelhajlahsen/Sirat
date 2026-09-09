import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline, Title3 } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";
import { frequencyLabel, isHabitDueOnDate } from "@/utils/habitFrequency";

type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  habits: Habit[];
  done: Record<string, boolean>;
  date: Date;
  onToggle: (habitId: string) => void;
};

export default function HabitChecklist({ habits, done, date, onToggle }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const dueHabits = habits.filter((h) => isHabitDueOnDate(h.frequency, date));
  if (dueHabits.length === 0) return null;

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Title3 style={styles.title}>Habits</Title3>
      {dueHabits.map((habit) => {
        const checked = done[habit.id] === true;
        return (
          <PressableScale
            key={habit.id}
            onPress={() => onToggle(habit.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={`Toggle ${habit.name}`}
            style={styles.row}
          >
            <Ionicons
              name={checked ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={checked ? colors.accentSecondary : colors.iconMuted}
            />
            <View style={styles.meta}>
              <Headline numberOfLines={1}>{habit.name}</Headline>
              <Caption color={colors.textTertiary}>{frequencyLabel(habit.frequency)}</Caption>
            </View>
            <Ionicons
              name={habit.icon as IoniconName}
              size={16}
              color={colors.iconMuted}
            />
          </PressableScale>
        );
      })}
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: { padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm },
    title: { marginBottom: spacing.xs },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 44,
    },
    meta: { flex: 1, gap: 2 },
  });
};
