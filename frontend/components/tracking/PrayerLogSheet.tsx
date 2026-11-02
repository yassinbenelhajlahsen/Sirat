// frontend/components/tracking/PrayerLogSheet.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import NativeSheet from "@/components/ui/NativeSheet";
import { Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";

type Props = {
  visible: boolean;
  prayerName: PrayerName | null;
  prayerLabel: string;
  currentStatus?: PrayerStatus;
  onSelect: (s: PrayerStatus) => void;
  onClear: () => void;
  onClose: () => void;
};

const OPTIONS: { status: PrayerStatus; label: string; token: keyof AppTheme["colors"] }[] = [
  { status: "prayed", label: "Prayed", token: "accentSecondary" },
  { status: "late", label: "Late", token: "accent" },
  { status: "missed", label: "Missed", token: "danger" },
];

export default function PrayerLogSheet({
  visible,
  prayerName,
  prayerLabel,
  currentStatus,
  onSelect,
  onClear,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <NativeSheet visible={visible} onClose={onClose} title={`Log ${prayerLabel}`}>
      <View style={styles.body}>
      <View style={styles.group}>
      {OPTIONS.map((opt, i) => {
        const active = currentStatus === opt.status;
        const color = colors[opt.token];
        return (
          <PressableScale
            key={opt.status}
            variant="row"
            onPress={() => prayerName && onSelect(opt.status)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Mark ${prayerLabel} ${opt.label}`}
            style={[styles.row, i > 0 && styles.separated]}
          >
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Headline style={styles.rowLabel}>{opt.label}</Headline>
            {active ? <AppIcon name="checkmark" size={18} color={colors.accent} /> : null}
          </PressableScale>
        );
      })}
      {currentStatus ? (
        <PressableScale
          variant="row"
          onPress={onClear}
          accessibilityRole="button"
          accessibilityLabel="Clear log"
          style={[styles.row, styles.separated]}
        >
          <AppIcon name="close-circle-outline" size={18} color={colors.textSecondary} />
          <Headline color={colors.textSecondary} style={styles.rowLabel}>Clear</Headline>
        </PressableScale>
      ) : null}
      </View>
      </View>
    </NativeSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
    group: {
      borderRadius: theme.radii.row,
      borderCurve: "continuous",
      backgroundColor: withOpacity(colors.white, 0.06),
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      minHeight: 48,
      paddingHorizontal: spacing.lg,
    },
    // Inset to the label edge, iOS grouped-list style.
    separated: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withOpacity(colors.white, 0.1),
    },
    swatch: { width: 14, height: 14, borderRadius: theme.radii.pill },
    rowLabel: { flex: 1 },
  });
};
