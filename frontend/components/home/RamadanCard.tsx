import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import PressableScale from "@/components/PressableScale";
import GlassSurface from "@/components/ui/GlassSurface";
import { Body, Footnote, Headline, Subhead } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerDay } from "@/services/prayerDay";
import getTimeUntil from "@/utils/getTimeUntil";
import { getRamadanCardState } from "@/utils/ramadanCountdown";

type Props = {
  enabled: boolean;
  prayerDay: PrayerDay | null;
  tomorrowFajr: Date | null;
  onLogMissedFast: () => void;
};

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function RamadanCard({ enabled, prayerDay, tomorrowFajr, onLogMissedFast }: Props) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  const state = getRamadanCardState({ now, enabled, prayerDay, tomorrowFajr });
  if (!state) return null;

  const { day, target } = state;
  const targetLabel = target?.kind === "iftar" ? "Iftar" : "Suhoor ends";

  return (
    <GlassSurface tier="card" radius={theme.radii.card} style={styles.card}>
      <Footnote color={colors.textSecondary}>{`Ramadan ${day}`}</Footnote>
      {target ? (
        <View style={styles.targetRow} accessibilityRole="timer">
          <View style={styles.targetText}>
            <Headline color={colors.white}>{`${targetLabel} at ${formatClock(target.at)}`}</Headline>
            <Subhead color={colors.accent}>{`in ${getTimeUntil(target.at)}`}</Subhead>
          </View>
        </View>
      ) : (
        <Body color={colors.textSecondary} style={styles.done}>Fast done for today.</Body>
      )}
      <PressableScale
        variant="button"
        onPress={onLogMissedFast}
        accessibilityRole="button"
        accessibilityLabel="Log a missed fast"
        hitSlop={8}
        style={styles.action}
      >
        <Subhead color={colors.accent}>Log a missed fast</Subhead>
      </PressableScale>
    </GlassSurface>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: { padding: theme.spacing.lg, gap: theme.spacing.xs },
    targetRow: { flexDirection: "row", alignItems: "center" },
    targetText: { flex: 1, gap: 2 },
    done: { marginTop: theme.spacing.xs },
    action: { alignSelf: "flex-start", marginTop: theme.spacing.sm },
  });
