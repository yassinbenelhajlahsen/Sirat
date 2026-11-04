import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import PrayerTimesList from "@/components/calendar/PrayerTimesList";
import AppIcon from "@/components/ui/AppIcon";
import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import SectionHeader from "@/components/ui/SectionHeader";
import { AppText, Body, Footnote, Headline, Title2 } from "@/components/ui/Text";
import type { AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import type { PrayerDayError } from "@/hooks/usePrayerDay";
import { emptyPrayerDay, type PrayerDay, type PrayerSlot } from "@/services/prayerDay";
import type { PrayerName, PrayerStatus } from "@/services/prayerTracker";
import { formatWeekdayMonthDay } from "@/utils/formatDate";
import { useRamadanMode } from "@/hooks/useRamadanMode";
import { isFastingDay } from "@/utils/hijriDate";

type DayDetailPanelProps = {
  date: Date;
  isToday: boolean;
  holiday: string | null;
  hijri: string;
  loading: boolean;
  prayerDay: PrayerDay | null;
  error: PrayerDayError | null;
  onRetry: () => void;
  onOpenSettings: () => void;
  nextPrayer: PrayerSlot | null;
  timeLeft: string;
  statuses: Partial<Record<PrayerName, PrayerStatus>>;
  onPressPrayer: (name: PrayerName, label: string) => void;
};

export default function DayDetailPanel({
  date,
  isToday,
  holiday,
  hijri,
  loading,
  prayerDay,
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

  const { ramadanMode } = useRamadanMode();
  const dateLine = formatWeekdayMonthDay(date);

  const ramadanDay = ramadanMode && isFastingDay(date);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Title2 numberOfLines={1}>{isToday ? `Today, ${dateLine}` : dateLine}</Title2>
          {/* One supporting line: Hijri, then the countdown, then the holiday. */}
          <Footnote color={colors.textTertiary} style={styles.supporting}>
            {hijri}
            {isToday && nextPrayer ? (
              <AppText variant="footnote" color={colors.accent}>
                {` · ${nextPrayer.name}${timeLeft ? ` in ${timeLeft}` : ""}`}
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
            {error.code === "LOCATION" ? (
              <Button
                label="Open Settings"
                variant="secondary"
                onPress={onOpenSettings}
                accessibilityLabel="Open app settings"
              />
            ) : null}
          </View>
        </GlassSurface>
      ) : !loading && !prayerDay?.slots.length ? (
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
        <View style={styles.prayers}>
          <SectionHeader title="Prayers" inset={0} />
          <PrayerTimesList
            prayerDay={prayerDay ?? emptyPrayerDay(date)}
            statuses={statuses}
            isToday={isToday}
            nextPrayer={nextPrayer}
            canLog={date.getTime() <= Date.now()}
            onPressPrayer={onPressPrayer}
            ramadan={ramadanDay}
          />
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { spacing } = theme;
  return StyleSheet.create({
    root: { flexGrow: 1 },
    prayers: { flexGrow: 1, marginTop: spacing.md },
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
