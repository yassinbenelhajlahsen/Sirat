import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption, Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";
import { frequencyLabel } from "@/utils/habitFrequency";

type IoniconName = keyof typeof Ionicons.glyphMap;

type Props = {
  habit: Habit;
  streak: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onArchive: () => void;
};

export default function HabitRow({
  habit,
  streak,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onArchive,
}: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <GlassSurface tier="row" radius={theme.radii.row} style={styles.row}>
      <View style={styles.icon}>
        <Ionicons name={habit.icon as IoniconName} size={18} color={colors.accentSecondary} />
      </View>
      <View style={styles.meta}>
        <Headline numberOfLines={1}>{habit.name}</Headline>
        <Caption color={withOpacity(colors.white, 0.6)}>{frequencyLabel(habit.frequency)}</Caption>
      </View>
      <View style={styles.streak}>
        <Text style={styles.flame}>🔥</Text>
        <Caption color={colors.accent} style={styles.streakNum}>{streak}</Caption>
      </View>
      <View style={styles.controls}>
        <PressableScale
          onPress={onMoveUp}
          disabled={!canMoveUp}
          accessibilityRole="button"
          accessibilityLabel={`Move ${habit.name} up`}
          style={styles.ctrlBtn}
        >
          <Ionicons name="chevron-up" size={16} color={canMoveUp ? colors.white : withOpacity(colors.white, 0.25)} />
        </PressableScale>
        <PressableScale
          onPress={onMoveDown}
          disabled={!canMoveDown}
          accessibilityRole="button"
          accessibilityLabel={`Move ${habit.name} down`}
          style={styles.ctrlBtn}
        >
          <Ionicons name="chevron-down" size={16} color={canMoveDown ? colors.white : withOpacity(colors.white, 0.25)} />
        </PressableScale>
        <PressableScale
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${habit.name}`}
          style={styles.ctrlBtn}
        >
          <Ionicons name="create-outline" size={16} color={withOpacity(colors.white, 0.8)} />
        </PressableScale>
        <PressableScale
          onPress={onArchive}
          accessibilityRole="button"
          accessibilityLabel={`Archive ${habit.name}`}
          style={styles.ctrlBtn}
        >
          <Ionicons name="archive-outline" size={16} color={withOpacity(colors.white, 0.8)} />
        </PressableScale>
      </View>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
    icon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withOpacity(colors.accentSecondary, 0.14),
    },
    meta: { flex: 1, gap: 2 },
    streak: { flexDirection: "row", alignItems: "center", gap: 3 },
    flame: { fontSize: 13 },
    streakNum: { fontWeight: "700" },
    controls: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    ctrlBtn: { padding: spacing.xs },
  });
};
