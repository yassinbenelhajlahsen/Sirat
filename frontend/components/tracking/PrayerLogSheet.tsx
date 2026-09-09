// frontend/components/tracking/PrayerLogSheet.tsx
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import AppIcon from "@/components/ui/AppIcon";
import SheetBackground from "@/components/ui/SheetBackground";
import SheetHeader from "@/components/ui/SheetHeader";
import { Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";

function LogSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

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
  const tabBarClearance = useTabBarClearance();

  const handleIndicatorStyle = useMemo(
    () => ({ backgroundColor: withOpacity(colors.white, 0.3), width: 38 }),
    [colors.white],
  );

  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (visible && !previousVisibleRef.current) {
      sheetRef.current?.snapToIndex(0);
    } else if (!visible && previousVisibleRef.current) {
      sheetRef.current?.close();
    }
    previousVisibleRef.current = visible;
  }, [visible]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        setMounted(false);
        onClose();
      }
    },
    [onClose],
  );

  if (!mounted) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      backgroundComponent={LogSheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={[styles.body, { paddingBottom: tabBarClearance + 16 }]}>
      <SheetHeader title={`Log ${prayerLabel}`} />
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
      </BottomSheetView>
    </BottomSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.xl, paddingTop: 0 },
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
