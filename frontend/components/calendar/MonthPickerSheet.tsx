// frontend/components/calendar/MonthPickerSheet.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import NativeSheet from "@/components/ui/NativeSheet";
import { Body, Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";

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

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) {
      list.push(y);
    }
    return list;
  }, [minDate, maxDate]);

  const [year, setYear] = useState(viewYear);

  useEffect(() => {
    if (visible) setYear(viewYear);
  }, [visible, viewYear]);

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

  return (
    <NativeSheet visible={visible} onClose={onClose} title="Jump to month">
      <View style={styles.body}>
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
      </View>
    </NativeSheet>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    body: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
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
