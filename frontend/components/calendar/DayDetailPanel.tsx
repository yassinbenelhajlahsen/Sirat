import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PrayerArc from "@/components/PrayerArc";
import AppIcon from "@/components/ui/AppIcon";
import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import { AppText, Body, Footnote, Headline, Title2 } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerTimesError } from "@/hooks/usePrayerTimes";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";
import type { PrayerTime } from "@/services/prayerTimes";

type DayDetailPanelProps = {
  date: Date;
  isToday: boolean;
  holiday: string | null;
  loading: boolean;
  prayerTimes: PrayerTime[];
  error: PrayerTimesError | null;
  onRetry: () => void;
  onOpenSettings: () => void;
  nextPrayer: { label: string; time: string } | null;
  timeLeft: string;
  statuses: Partial<Record<PrayerName, PrayerStatus>>;
  onPressPrayer: (name: PrayerName, label: string) => void;
};

export default function DayDetailPanel({
  date,
  isToday,
  holiday,
  loading,
  prayerTimes,
  error,
  onRetry,
  onOpenSettings,
  nextPrayer,
  timeLeft,
  statuses,
  onPressPrayer,
}: DayDetailPanelProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const dateLine = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);

  const hijri = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Title2 numberOfLines={1}>{isToday ? `Today, ${dateLine}` : dateLine}</Title2>
          {/* One supporting line: Hijri, then the countdown, then the holiday. */}
          <Footnote color={colors.textTertiary} style={styles.supporting}>
            {hijri}
            {isToday && nextPrayer ? (
              <AppText variant="footnote" color={colors.accent}>
                {` · ${nextPrayer.label}${timeLeft ? ` in ${timeLeft}` : ""}`}
              </AppText>
            ) : null}
            {holiday ? (
              <AppText variant="footnote" color={colors.textSecondary}>
                {` · ${holiday}`}
              </AppText>
            ) : null}
          </Footnote>
        </View>
      </View>

      {error ? (
        <GlassSurface tier="card" radius={theme.radii.card} style={styles.stateCard}>
          <View style={styles.stateHeader}>
            <AppIcon name="alert-circle" size={18} color={colors.accent} />
            <Headline color={colors.accent} style={styles.stateTitle}>
              Problem loading prayer times
            </Headline>
          </View>
          <Body color={colors.textSecondary} style={styles.stateMsg}>
            {error.message}
          </Body>
          <View style={styles.stateActions}>
            <Button
              label="Try again"
              onPress={onRetry}
              accessibilityLabel="Retry loading prayer times"
            />
            {error.code === "PERMISSION" ? (
              <Button
                label="Open Settings"
                variant="secondary"
                onPress={onOpenSettings}
                accessibilityLabel="Open app settings"
              />
            ) : null}
          </View>
        </GlassSurface>
      ) : !loading && prayerTimes.length === 0 ? (
        <GlassSurface tier="card" radius={theme.radii.card} style={styles.stateCard}>
          <Body color={colors.textSecondary} style={styles.emptyText}>
            No prayer times available for this date.
          </Body>
          <Button
            label="Try again"
            onPress={onRetry}
            accessibilityLabel="Retry loading prayer times"
            style={styles.emptyBtn}
          />
        </GlassSurface>
      ) : (
        <PrayerArc
          loading={loading}
          prayerTimes={prayerTimes}
          nextPrayer={isToday ? nextPrayer : null}
          live={isToday}
          logging
          statuses={statuses}
          onPressPrayer={onPressPrayer}
        />
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    headerText: { flexShrink: 1 },
    supporting: { marginTop: 2 },
    stateCard: { padding: spacing.lg },
    stateHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    stateTitle: { flexShrink: 1 },
    stateMsg: { marginTop: spacing.sm },
    stateActions: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.md,
      marginTop: spacing.md,
    },
    emptyText: { textAlign: "center" },
    emptyBtn: { alignSelf: "center", marginTop: spacing.md },
  });
};
