// frontend/components/calendar/MonthPickerSheet.tsx
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import SheetBackground from "@/components/ui/SheetBackground";
import SheetHeader from "@/components/ui/SheetHeader";
import { Body, Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
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
  const haptics = useHaptics();
  const tabBarClearance = useTabBarClearance();

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
        <SheetHeader title="Jump to month" />

        <View style={styles.yearRow}>
          {years.map((y) => {
            const active = y === year;
            const isThisYear = y === today.getFullYear();
            return (
              <PressableScale
                key={y}
                variant="row"
                onPress={() => {
                  haptics("selection");
                  setYear(y);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  isThisYear ? `Show months of ${y}, current year` : `Show months of ${y}`
                }
                style={[styles.yearPill, active && styles.yearPillActive]}
              >
                <Headline color={active ? colors.onAccent : isThisYear ? colors.accent : colors.white}>
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
                  variant="row"
                  onPress={() => handleMonthPress(m)}
                  disabled={!inRange}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: !inRange }}
                  accessibilityLabel={
                    isThisMonth ? `${label} ${year}, current month` : `${label} ${year}`
                  }
                  style={[styles.monthCell, selected && styles.monthCellSelected]}
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
    body: { paddingHorizontal: spacing.xl, paddingTop: 0 },
    yearRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    yearPill: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 40,
      borderRadius: theme.radii.pill,
      borderCurve: "circular",
      backgroundColor: withOpacity(colors.white, 0.08),
    },
    yearPillActive: { backgroundColor: colors.accent },
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
      borderCurve: "continuous",
      backgroundColor: withOpacity(colors.white, 0.08),
    },
    // Today's month reads in gold text on the normal fill, never as a border.
    monthCellSelected: { backgroundColor: colors.accent },
  });
};
