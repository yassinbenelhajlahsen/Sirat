import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";
import { frequencyLabel } from "@/utils/habitFrequency";

type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  habits: Habit[];
  done: Record<string, boolean>;
  onToggle: (habitId: string) => void;
};

export default function HabitChecklist({ habits, done, onToggle }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (habits.length === 0) return null;

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Title3 style={styles.title}>Habits</Title3>
      {habits.map((habit) => {
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
              color={checked ? colors.accentSecondary : withOpacity(colors.white, 0.5)}
            />
            <View style={styles.meta}>
              <Headline numberOfLines={1}>{habit.name}</Headline>
              <Caption color={withOpacity(colors.white, 0.6)}>{frequencyLabel(habit.frequency)}</Caption>
            </View>
            <Ionicons
              name={habit.icon as IoniconName}
              size={16}
              color={withOpacity(colors.white, 0.4)}
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
    },
    meta: { flex: 1, gap: 2 },
  });
};
