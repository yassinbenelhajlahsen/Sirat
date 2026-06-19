// frontend/components/tracking/PrayerLogSheet.tsx
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "@/components/PressableScale";
import SheetBackground from "@/components/ui/SheetBackground";
import { Headline, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
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
  const insets = useSafeAreaInsets();

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
      onChange={handleSheetChange}
    >
      <BottomSheetView style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <Title3 style={styles.title}>Log {prayerLabel}</Title3>
        {OPTIONS.map((opt) => {
          const active = currentStatus === opt.status;
          const color = colors[opt.token];
          return (
            <PressableScale
              key={opt.status}
              onPress={() => prayerName && onSelect(opt.status)}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${prayerLabel} ${opt.label}`}
            >
              <View style={[styles.row, active && { borderColor: withOpacity(color, 0.5) }]}>
                <View style={[styles.swatch, { backgroundColor: color }]} />
                <Headline style={styles.rowLabel}>{opt.label}</Headline>
                {active ? <Ionicons name="checkmark" size={18} color={color} /> : null}
              </View>
            </PressableScale>
          );
        })}
        {currentStatus ? (
          <PressableScale onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear log">
            <View style={styles.clearRow}>
              <Ionicons name="close-circle-outline" size={18} color={withOpacity(colors.white, 0.7)} />
              <Headline color={withOpacity(colors.white, 0.7)} style={styles.rowLabel}>Clear</Headline>
            </View>
          </PressableScale>
        ) : null}
      </BottomSheetView>
    </BottomSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm },
    title: { marginBottom: spacing.sm },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: theme.radii.row,
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.08),
    },
    swatch: { width: 14, height: 14, borderRadius: 999 },
    rowLabel: { flex: 1 },
    clearRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
  });
};
