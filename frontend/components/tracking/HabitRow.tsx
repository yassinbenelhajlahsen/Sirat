import { useCallback, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import PressableScale from "@/components/PressableScale";
import AppIcon, { type AppIconName } from "@/components/ui/AppIcon";
import IconButton from "@/components/ui/IconButton";
import { Body, Caption, Footnote } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { Habit } from "@/services/habitTracker";
import { showActionMenu } from "@/utils/actionMenu";
import { frequencyLabel } from "@/utils/habitFrequency";

type Props = {
  habit: Habit;
  streak: number;
  dueToday: boolean;
  doneToday: boolean;
  onToggleToday: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onArchive: () => void;
  /** Rows after the first draw a hairline inset to the text edge. */
  separated?: boolean;
};

/**
 * One habit in the Tracker list. Secondary actions live behind a swipe (Edit,
 * Archive) and a labelled "more" button that opens a native menu with the same
 * actions plus reorder, so nothing depends on a 24pt icon or a gesture alone.
 */
export default function HabitRow({
  habit,
  streak,
  dueToday,
  doneToday,
  onToggleToday,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onArchive,
  separated = false,
}: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const swipeRef = useRef<Swipeable>(null);

  const closeSwipe = useCallback(() => swipeRef.current?.close(), []);

  const openMenu = useCallback(() => {
    showActionMenu({
      title: habit.name,
      theme,
      options: [
        { label: "Edit", onPress: onEdit },
        ...(canMoveUp ? [{ label: "Move up", onPress: onMoveUp }] : []),
        ...(canMoveDown ? [{ label: "Move down", onPress: onMoveDown }] : []),
        { label: "Archive", onPress: onArchive, destructive: true },
      ],
    });
  }, [canMoveDown, canMoveUp, habit.name, onArchive, onEdit, onMoveDown, onMoveUp, theme]);

  const renderRightActions = useCallback(
    () => (
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${habit.name}`}
          onPress={() => {
            closeSwipe();
            onEdit();
          }}
          style={[styles.action, styles.actionEdit]}
        >
          <AppIcon name="create-outline" size={20} color={colors.onAccent} />
          <Caption color={colors.onAccent} style={styles.actionLabel}>Edit</Caption>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Archive ${habit.name}`}
          onPress={() => {
            closeSwipe();
            onArchive();
          }}
          style={[styles.action, styles.actionArchive]}
        >
          <AppIcon name="archive-outline" size={20} color={colors.onAccent} />
          <Caption color={colors.onAccent} style={styles.actionLabel}>Archive</Caption>
        </Pressable>
      </View>
    ),
    [closeSwipe, colors.onAccent, habit.name, onArchive, onEdit, styles],
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
    >
      <View style={[styles.row, separated && styles.separated]}>
        {dueToday ? (
          <PressableScale
            variant="button"
            onPress={onToggleToday}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: doneToday }}
            accessibilityLabel={`Mark ${habit.name} done today`}
            style={styles.check}
          >
            <AppIcon
              name={doneToday ? "checkmark-circle" : "ellipse-outline"}
              size={26}
              color={doneToday ? colors.accentSecondary : colors.iconMuted}
            />
          </PressableScale>
        ) : (
          <View
            testID={`habitrow-notdue-${habit.id}`}
            style={styles.check}
            accessible
            accessibilityLabel={`${habit.name} is not due today`}
          >
            <View style={styles.notDue} />
          </View>
        )}
        <View style={styles.icon}>
          <AppIcon name={habit.icon as AppIconName} size={18} color={colors.accentSecondary} />
        </View>
        <View style={styles.meta}>
          <Body numberOfLines={1}>{habit.name}</Body>
          <Footnote color={colors.textTertiary}>{frequencyLabel(habit.frequency)}</Footnote>
        </View>
        <View style={styles.streak} accessible accessibilityLabel={`${streak} day streak`}>
          <Text style={styles.flame} maxFontSizeMultiplier={1.2}>🔥</Text>
          <Footnote color={colors.textTertiary} style={styles.streakNum}>{streak}</Footnote>
        </View>
        <IconButton
          icon="ellipsis-horizontal"
          variant="plain"
          size={40}
          iconSize={20}
          color={colors.iconMuted}
          accessibilityLabel={`More options for ${habit.name}`}
          accessibilityHint="Edit, reorder or archive this habit"
          onPress={openMenu}
        />
      </View>
    </Swipeable>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
      minHeight: 56,
    },
    // Inset to the text edge: the 44pt check slot plus the 34pt glyph and gaps.
    separated: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(colors.white, 0.1),
    },
    check: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    notDue: {
      width: 10,
      height: 10,
      borderRadius: 999,
      backgroundColor: withOpacity(colors.white, 0.18),
    },
    icon: { width: 28, alignItems: "center", justifyContent: "center" },
    meta: { flex: 1, gap: 2, minWidth: 0 },
    streak: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    flame: { fontSize: 13 },
    streakNum: { fontWeight: "700" },
    actions: { flexDirection: "row", alignItems: "stretch", gap: spacing.sm, paddingLeft: spacing.sm },
    action: {
      width: 72,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      borderRadius: theme.radii.pill,
      borderCurve: "circular",
    },
    actionEdit: { backgroundColor: colors.accent },
    actionArchive: { backgroundColor: colors.danger },
    actionLabel: { fontWeight: "600" },
  });
};
