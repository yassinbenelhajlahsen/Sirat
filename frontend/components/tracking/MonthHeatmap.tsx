// frontend/components/tracking/MonthHeatmap.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";

type Cell = { day: number; score: number } | null;

const LEGEND_STEPS = [0.25, 0.5, 0.75, 1];

function buildWeeks(scores: number[], year: number, monthIndex0: number): Cell[][] {
  const firstWeekday = new Date(year, monthIndex0, 1).getDay(); // 0 = Sunday
  const cells: Cell[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  scores.forEach((score, i) => cells.push({ day: i + 1, score }));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function MonthHeatmap({
  scores,
  year,
  monthIndex0,
}: {
  scores: number[];
  year: number;
  monthIndex0: number;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const weeks = useMemo(() => buildWeeks(scores, year, monthIndex0), [scores, year, monthIndex0]);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(year, monthIndex0, 1),
  );
  const monthShort = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    new Date(year, monthIndex0, 1),
  );

  const cellColor = (score: number) =>
    score > 0
      ? withOpacity(colors.accentSecondary, 0.18 + score * 0.72)
      : withOpacity(colors.white, 0.06);

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Caption color={colors.textTertiary} style={styles.heading}>
        {monthName}
      </Caption>
      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.week}>
            {week.map((cell, ci) =>
              cell ? (
                <View
                  key={ci}
                  testID={`heatcell-${cell.day}`}
                  accessible
                  accessibilityLabel={`${monthShort} ${cell.day}: ${Math.round(cell.score * 100)}% of prayers logged`}
                  style={[styles.cell, { backgroundColor: cellColor(cell.score) }]}
                />
              ) : (
                <View key={ci} style={[styles.cell, styles.empty]} />
              ),
            )}
          </View>
        ))}
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Caption color={colors.textTertiary}>Less</Caption>
        {LEGEND_STEPS.map((step) => (
          <View key={step} style={[styles.legendSwatch, { backgroundColor: cellColor(step) }]} />
        ))}
        <Caption color={colors.textTertiary}>More</Caption>
      </View>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: { padding: spacing.lg, gap: spacing.md },
    heading: { letterSpacing: 1.2 },
    grid: { gap: spacing.xs },
    week: { flexDirection: "row", justifyContent: "space-between" },
    cell: { flex: 1, aspectRatio: 1, marginHorizontal: 2, borderRadius: 6 },
    empty: { backgroundColor: "transparent" },
    legend: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: spacing.xs,
    },
    legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  });
};
