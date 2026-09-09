import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon, { type AppIconName } from "@/components/ui/AppIcon";
import GlassSurface from "@/components/ui/GlassSurface";
import SectionHeader from "@/components/ui/SectionHeader";
import { Body, Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";
import { frequencyLabel, isHabitDueOnDate } from "@/utils/habitFrequency";

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
    <View style={styles.section}>
      <SectionHeader title="Habits" />
      <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
        {dueHabits.map((habit, i) => {
          const checked = done[habit.id] === true;
          return (
            <PressableScale
              key={habit.id}
              variant="row"
              onPress={() => onToggle(habit.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={`Toggle ${habit.name}`}
              style={[styles.row, i > 0 && styles.separated]}
            >
              <AppIcon
                name={checked ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={checked ? colors.accentSecondary : colors.iconMuted}
              />
              <View style={styles.meta}>
                <Body numberOfLines={1}>{habit.name}</Body>
                <Footnote color={colors.textTertiary}>{frequencyLabel(habit.frequency)}</Footnote>
              </View>
              <AppIcon name={habit.icon as AppIconName} size={16} color={colors.iconMuted} />
            </PressableScale>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    section: { marginTop: spacing.xxl },
    card: { paddingHorizontal: spacing.lg },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 56,
    },
    // Inset to the text edge: glyph slot (22) plus its gap.
    separated: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(colors.white, 0.1),
    },
    meta: { flex: 1, gap: 2 },
  });
};
