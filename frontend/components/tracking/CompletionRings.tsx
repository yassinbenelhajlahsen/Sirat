// frontend/components/tracking/CompletionRings.tsx
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import DisplayNumber from "@/components/ui/DisplayNumber";
import GlassSurface from "@/components/ui/GlassSurface";
import { Caption } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerName } from "@/services/prayerTracker";

const ORDER: { name: PrayerName; label: string }[] = [
  { name: "fajr", label: "Fajr" },
  { name: "dhuhr", label: "Dhuhr" },
  { name: "asr", label: "Asr" },
  { name: "maghrib", label: "Maghrib" },
  { name: "isha", label: "Isha" },
];

const SIZE = 54;
const STROKE = 5;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function CompletionRings({
  byPrayer,
}: {
  byPrayer: Record<PrayerName, number>;
}) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Caption color={withOpacity(colors.white, 0.6)} style={styles.heading}>
        THIS MONTH
      </Caption>
      <View style={styles.row}>
        {ORDER.map(({ name, label }) => {
          const value = byPrayer[name] ?? 0;
          const pct = Math.round(value * 100);
          const offset = CIRC * (1 - Math.max(0, Math.min(1, value)));
          return (
            <View key={name} style={styles.ring} testID={`ring-${name}`}>
              <Svg width={SIZE} height={SIZE}>
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={withOpacity(colors.white, 0.1)}
                  strokeWidth={STROKE}
                />
                <Circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={colors.accentSecondary}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={offset}
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                />
              </Svg>
              <View style={styles.pctWrap} pointerEvents="none">
                <DisplayNumber value={pct} size={14} color={colors.white} />
              </View>
              <Caption color={withOpacity(colors.white, 0.6)} style={styles.label}>
                {label}
              </Caption>
            </View>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    card: { padding: spacing.lg, gap: spacing.md },
    heading: { letterSpacing: 1.2 },
    row: { flexDirection: "row", justifyContent: "space-between" },
    ring: { alignItems: "center", width: SIZE },
    pctWrap: { position: "absolute", top: 0, width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
    label: { marginTop: spacing.xs },
  });
};
