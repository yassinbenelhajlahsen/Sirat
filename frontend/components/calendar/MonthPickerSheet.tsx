// frontend/components/calendar/MonthPickerSheet.tsx
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "@/components/PressableScale";
import SheetBackground from "@/components/ui/SheetBackground";
import { Body, Headline, Title3 } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

function PickerSheetBackground(p: Parameters<typeof SheetBackground>[0]) {
  return <SheetBackground {...p} solid />;
}

type Props = {
  visible: boolean;
  viewYear: number;
  viewMonth: number;
  today: Date;
  minDate: Date;
  maxDate: Date;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
};

const MONTH_LABELS = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m).toLocaleString("default", { month: "short" }),
);

export default function MonthPickerSheet({
  visible,
  viewYear,
  viewMonth,
  today,
  minDate,
  maxDate,
  onSelect,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();
  // Mirrors GlassTabBar's layout: bottom offset + pill height + gap.
  const tabBarClearance = Math.max(insets.bottom, 14) + 6 + 64 + 8;

  const handleIndicatorStyle = useMemo(
    () => ({ backgroundColor: withOpacity(colors.white, 0.3), width: 38 }),
    [colors.white],
  );

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) {
      list.push(y);
    }
    return list;
  }, [minDate, maxDate]);

  const [year, setYear] = useState(viewYear);

  const [mounted, setMounted] = useState(visible);
  const sheetRef = useRef<BottomSheet>(null);
  const previousVisibleRef = useRef(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setYear(viewYear);
    }
  }, [visible, viewYear]);

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

  const isMonthInRange = useCallback(
    (y: number, m: number) => {
      const monthStart = new Date(y, m);
      return monthStart >= minDate && monthStart <= maxDate;
    },
    [minDate, maxDate],
  );

  const handleMonthPress = useCallback(
    (m: number) => {
      haptics("selection");
      onSelect(year, m);
    },
    [haptics, onSelect, year],
  );

  if (!mounted) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      enableDynamicSizing
      enablePanDownToClose
      backgroundComponent={PickerSheetBackground}
      handleIndicatorStyle={handleIndicatorStyle}
      onChange={handleSheetChange}
    >
      <BottomSheetView style={[styles.body, { paddingBottom: tabBarClearance + 16 }]}>
        <Title3 style={styles.title}>Jump to month</Title3>

        <View style={styles.yearRow}>
          {years.map((y) => {
            const active = y === year;
            const isThisYear = y === today.getFullYear();
            return (
              <PressableScale
                key={y}
                onPress={() => {
                  haptics("selection");
                  setYear(y);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  isThisYear ? `Show months of ${y}, current year` : `Show months of ${y}`
                }
                style={[
                  styles.yearPill,
                  !active && isThisYear && styles.yearPillThisYear,
                  active && styles.yearPillActive,
                ]}
              >
                <Headline color={active ? colors.onAccent : colors.white}>
                  {String(y)}
                </Headline>
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.monthGrid}>
          {MONTH_LABELS.map((label, m) => {
            const inRange = isMonthInRange(year, m);
            const selected = year === viewYear && m === viewMonth;
            const isThisMonth =
              year === today.getFullYear() && m === today.getMonth();
            return (
              <View key={label} style={styles.monthCellWrap}>
                <PressableScale
                  onPress={() => handleMonthPress(m)}
                  disabled={!inRange}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: !inRange }}
                  accessibilityLabel={
                    isThisMonth ? `${label} ${year}, current month` : `${label} ${year}`
                  }
                  style={[
                    styles.monthCell,
                    !selected && isThisMonth && styles.monthCellThisMonth,
                    selected && styles.monthCellSelected,
                  ]}
                >
                  <Body
                    color={
                      selected
                        ? colors.onAccent
                        : isThisMonth
                        ? colors.accent
                        : inRange
                        ? colors.white
                        : withOpacity(colors.white, 0.3)
                    }
                  >
                    {label}
                  </Body>
                </PressableScale>
              </View>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
    title: { marginBottom: spacing.md },
    yearRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    yearPill: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.sm + 2,
      borderRadius: theme.radii.row,
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.12),
    },
    yearPillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    yearPillThisYear: {
      borderColor: withOpacity(colors.accent, 0.45),
    },
    monthGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    monthCellWrap: {
      width: "25%",
      padding: spacing.xs,
    },
    monthCell: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 44,
      borderRadius: theme.radii.chip,
      borderWidth: 1,
      borderColor: withOpacity(colors.white, 0.08),
    },
    monthCellSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    // Today's month: visible but quieter than the selected fill.
    monthCellThisMonth: {
      borderWidth: 1.5,
      borderColor: withOpacity(colors.accent, 0.6),
    },
  });
};
