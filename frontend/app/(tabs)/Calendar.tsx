import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import DayDetailPanel from "@/components/calendar/DayDetailPanel";
import MonthPickerSheet from "@/components/calendar/MonthPickerSheet";
import PressableScale from "@/components/PressableScale";
import HabitChecklist from "@/components/tracking/HabitChecklist";
import PrayerLogSheet from "@/components/tracking/PrayerLogSheet";
import AppIcon from "@/components/ui/AppIcon";
import Button from "@/components/ui/Button";
import GlassSurface from "@/components/ui/GlassSurface";
import IconButton from "@/components/ui/IconButton";
import Screen from "@/components/ui/Screen";
import ScreenHeader from "@/components/ui/ScreenHeader";
import SectionHeader from "@/components/ui/SectionHeader";
import { Body, Caption, Headline } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useScreenMargin } from "@/hooks/useScreenMargin";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { useHabitLog } from "@/hooks/useHabitLog";
import { useHabits } from "@/hooks/useHabits";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useCalendarNavigationTransitions } from "@/hooks/useCalendarNavigationTransitions";
import { useCalendarViewState } from "@/hooks/useCalendarViewState";
import { useNextPrayer } from "@/hooks/useNextPrayer";
import { usePrayerLog } from "@/hooks/usePrayerLog";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { getLastResolvedCoords } from "@/services/prayer-times/environment";
import { useRamadanTracker } from "@/hooks/useRamadanTracker";
import { dateKeyFromDate } from "@/services/holidayService";
import type { PrayerName } from "@/services/prayerTracker";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function useDialCoords(prayerTimes: unknown[]) {
  const [coords, setCoords] = useState(getLastResolvedCoords);
  useEffect(() => {
    setCoords(getLastResolvedCoords());
  }, [prayerTimes]);
  return coords;
}

export default function CalendarScreen() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const haptics = useHaptics();
  const screenMargin = useScreenMargin();

  const { month, year, date } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const {
    today,
    minDate,
    maxDate,
    viewYear,
    setViewYear,
    viewMonth,
    setViewMonth,
    viewMonthRef,
    viewYearRef,
    initialIsViewingToday,
    isViewingToday,
    canGoPrev,
    canGoNext,
    dayButtonSize,
    fullMatrix,
    monthName,
  } = useCalendarViewState({ monthParam: month, yearParam: year, isSmall });

  const {
    holidayMap,
    loadingHolidays,
    ramadanStart,
    ramadanEnd,
    ramadanSummary,
    ramadanMonthActive,
    firstMissedFastDate,
    missedDaysLabel,
    showRamadanSummary,
    reloadMissedFasts,
  } = useCalendarData(viewYear, viewMonth);

  const {
    navigating,
    fadeAnim,
    translateX,
    backToTodayAnim,
    panHandlers,
    goToPreviousMonth,
    goToNextMonth,
    goBackToToday,
  } = useCalendarNavigationTransitions({
    viewYear,
    viewMonth,
    setViewYear,
    setViewMonth,
    viewYearRef,
    viewMonthRef,
    minDate,
    maxDate,
    today,
    screenWidth: width,
    initialIsViewingToday,
    isViewingToday,
  });
  const tabBarClearance = useTabBarClearance();

  // ---- Selected day (inline agenda) ----
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const pendingSelectRef = useRef<Date | null>(null);

  // On mount and whenever the viewed month changes, resolve the selection:
  // an explicit pending pick wins; otherwise auto-select today if it's in
  // view, else clear to the prompt.
  useEffect(() => {
    if (pendingSelectRef.current) {
      setSelectedDate(pendingSelectRef.current);
      pendingSelectRef.current = null;
      return;
    }
    const todayInView =
      viewMonth === today.getMonth() && viewYear === today.getFullYear();
    setSelectedDate(todayInView ? new Date(today) : null);
    // `today` is a fresh Date each render; intentionally keyed on the month only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth, viewYear]);

  // Pre-select a day requested via the `date` param (e.g. "Finished all
  // prayers!" on Home → tomorrow). Bring its month into view if needed and let
  // the selection-resolving effect above consume the pending pick.
  useEffect(() => {
    if (typeof date !== "string") return;
    const target = new Date(decodeURIComponent(date));
    if (isNaN(target.getTime())) return;
    const m = target.getMonth();
    const y = target.getFullYear();
    if (m !== viewMonthRef.current || y !== viewYearRef.current) {
      pendingSelectRef.current = target;
      setViewYear(y);
      setViewMonth(m);
    } else {
      setSelectedDate(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const ramadanParam = useMemo(
    () => ({
      start: ramadanStart?.toISOString(),
      end: ramadanEnd?.toISOString(),
    }),
    [ramadanStart, ramadanEnd],
  );

  const { prayerTimes, loading, error, retry, prayerTimesDateKey } =
    usePrayerTimes(selectedDate);
  const dialCoords = useDialCoords(prayerTimes);
  const { nextPrayer, timeLeft } = useNextPrayer(
    selectedDate,
    prayerTimes,
    prayerTimesDateKey,
  );
  const { isRamadan, isFastMissed, toggleMissedFast } = useRamadanTracker(
    selectedDate,
    ramadanParam.start,
    ramadanParam.end,
  );

  const selectedIsToday =
    !!selectedDate && selectedDate.toDateString() === today.toDateString();
  const selectedHoliday = selectedDate
    ? holidayMap[dateKeyFromDate(selectedDate)] ?? null
    : null;

  const selectDay = useCallback(
    (day: number) => {
      if (day <= 0) return;
      haptics("selection");
      setSelectedDate(new Date(viewYear, viewMonth, day));
    },
    [haptics, viewMonth, viewYear],
  );

  const handlePrevMonth = useCallback(() => {
    haptics("selection");
    goToPreviousMonth();
  }, [goToPreviousMonth, haptics]);

  const handleNextMonth = useCallback(() => {
    haptics("selection");
    goToNextMonth();
  }, [goToNextMonth, haptics]);

  const handleRamadanSummaryPress = useCallback(() => {
    if (!firstMissedFastDate) return;
    haptics("selection");
    const m = firstMissedFastDate.getMonth();
    const y = firstMissedFastDate.getFullYear();
    if (m !== viewMonth || y !== viewYear) {
      pendingSelectRef.current = firstMissedFastDate;
      setViewYear(y);
      setViewMonth(m);
    } else {
      setSelectedDate(firstMissedFastDate);
    }
  }, [firstMissedFastDate, haptics, setViewMonth, setViewYear, viewMonth, viewYear]);

  // Mark/clear the selected day's fast, then refresh the month summary in place
  // (the toggle no longer navigates, so nothing else would reload the summary).
  const onToggleMissed = useCallback(async () => {
    haptics("light");
    await toggleMissedFast();
    reloadMissedFasts();
  }, [haptics, reloadMissedFasts, toggleMissedFast]);

  const openSettings = useCallback(async () => {
    try {
      if (Platform.OS === "ios") await Linking.openURL("app-settings:");
      else await Linking.openSettings();
    } catch {}
  }, []);

  const selectedDayKey = selectedDate ? dateKeyFromDate(selectedDate) : "";
  const { statuses, setStatus, clearStatus } = usePrayerLog(selectedDayKey);
  const { habits } = useHabits();
  const { done: habitDone, toggle: toggleHabit } = useHabitLog(selectedDayKey);
  const [prayerSheet, setPrayerSheet] = useState<{ name: PrayerName; label: string } | null>(null);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const openMonthPicker = useCallback(() => {
    haptics("selection");
    setMonthPickerOpen(true);
  }, [haptics]);

  const handleMonthPicked = useCallback(
    (year: number, month: number) => {
      setViewYear(year);
      setViewMonth(month);
      setMonthPickerOpen(false);
    },
    [setViewMonth, setViewYear],
  );

  return (
    <View style={styles.fill}>
    <Screen>
      <View style={styles.fill}>
        {/* Header: Large Title + the month switcher as a trailing accessory */}
        <View style={[styles.header, { paddingHorizontal: screenMargin }]}>
          <ScreenHeader
            title="Calendar"
            trailing={
              <View style={styles.monthSwitcher}>
                <IconButton
                  icon="chevron-back"
                  variant="plain"
                  size={40}
                  iconSize={20}
                  color={colors.accent}
                  onPress={handlePrevMonth}
                  disabled={!canGoPrev}
                  accessibilityLabel="Previous month"
                />
                <PressableScale
                  variant="button"
                  onPress={openMonthPicker}
                  accessibilityRole="button"
                  accessibilityLabel="Choose month and year"
                  accessibilityHint="Opens the month picker"
                  style={styles.monthLabel}
                >
                  <Headline>
                    {monthName.slice(0, 3)} {viewYear}
                  </Headline>
                </PressableScale>
                <IconButton
                  icon="chevron-forward"
                  variant="plain"
                  size={40}
                  iconSize={20}
                  color={colors.accent}
                  onPress={handleNextMonth}
                  disabled={!canGoNext}
                  accessibilityLabel="Next month"
                />
              </View>
            }
          />
        </View>

        {/* Weekday row */}
        <View style={[styles.weekdayRow, { paddingHorizontal: screenMargin }]}>
          {WEEKDAYS.map((d, i) => (
            <Caption
              key={`${d}-${i}`}
              color={colors.textTertiary}
              style={[styles.weekdayText, { width: dayButtonSize }]}
            >
              {d}
            </Caption>
          ))}
        </View>

        {/* Fixed-height 6-row grid (month swipe lives here only) */}
        <Animated.View
          {...panHandlers}
          style={[
            styles.gridWrap,
            { paddingHorizontal: screenMargin, opacity: fadeAnim, transform: [{ translateX }] },
          ]}
        >
          {loadingHolidays ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={colors.accent} />
            </View>
          ) : (
            fullMatrix.map((week, i) => (
              <View key={i} style={styles.weekRow}>
                {week.map((day, j) => {
                  const isToday =
                    day === today.getDate() &&
                    viewMonth === today.getMonth() &&
                    viewYear === today.getFullYear();
                  const holidayName =
                    day > 0
                      ? holidayMap[dateKeyFromDate(new Date(viewYear, viewMonth, day))] ?? null
                      : null;
                  const isSelected =
                    !!selectedDate &&
                    day > 0 &&
                    selectedDate.getDate() === day &&
                    selectedDate.getMonth() === viewMonth &&
                    selectedDate.getFullYear() === viewYear;
                  return (
                    <PressableScale
                      key={j}
                      variant="row"
                      onPress={() => selectDay(day)}
                      disabled={navigating || day <= 0}
                      accessibilityRole="button"
                      accessibilityLabel={
                        day > 0 ? `Select ${monthName} ${day}, ${viewYear}` : "Empty day"
                      }
                      style={[
                        styles.dayButton,
                        { width: dayButtonSize, height: dayButtonSize, borderRadius: dayButtonSize / 2 },
                        isToday ? styles.dayToday : isSelected ? styles.daySelected : null,
                      ]}
                    >
                      <Body
                        color={
                          isToday ? colors.onAccent : isSelected ? colors.accent : colors.white
                        }
                        style={styles.dayText}
                        maxFontSizeMultiplier={1.2}
                      >
                        {day > 0 ? String(day) : ""}
                      </Body>
                      {holidayName && !isToday ? <View style={styles.holidayDot} /> : null}
                    </PressableScale>
                  );
                })}
              </View>
            ))
          )}
        </Animated.View>

        <View style={[styles.divider, { marginHorizontal: screenMargin }]} />

        {/* Scrolling day panel */}
        <ScrollView
          style={styles.fill}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.panelContent,
            { paddingHorizontal: screenMargin, paddingBottom: tabBarClearance + spacing.lg },
          ]}
        >
          {!isViewingToday && (
            <Animated.View style={[styles.backToToday, { opacity: backToTodayAnim }]}>
              <Button
                label="Back to today"
                variant="secondary"
                icon="today-outline"
                onPress={goBackToToday}
                accessibilityLabel="Back to current month"
              />
            </Animated.View>
          )}

          {ramadanMonthActive && (
            <View style={styles.section}>
            <SectionHeader title="Ramadan" />
            <GlassSurface tier="card" radius={theme.radii.card} style={styles.ramadanCard}>
              {showRamadanSummary ? (
                <PressableScale
                  variant="row"
                  onPress={handleRamadanSummaryPress}
                  accessibilityRole="button"
                  accessibilityLabel="Open first missed Ramadan fast date"
                  style={styles.ramadanRow}
                >
                  <View style={styles.ramadanTextWrap}>
                    <Body color={colors.white}>
                      {ramadanSummary?.totalMissed ?? 0} missed{" "}
                      {(ramadanSummary?.totalMissed ?? 0) === 1 ? "fast" : "fasts"}
                    </Body>
                    {missedDaysLabel ? (
                      <Caption color={colors.textSecondary}>{missedDaysLabel}</Caption>
                    ) : null}
                  </View>
                  <AppIcon name="chevron-forward" size={20} color={colors.iconMuted} />
                </PressableScale>
              ) : (
                <View style={styles.ramadanRow}>
                  <Body color={colors.textSecondary}>No missed fasts</Body>
                </View>
              )}

              {selectedDate && isRamadan ? (
                <Button
                  label={
                    isFastMissed
                      ? `Day ${selectedDate.getDate()} · marked missed`
                      : `Mark Day ${selectedDate.getDate()} missed`
                  }
                  icon={isFastMissed ? "checkmark-circle" : "ellipse-outline"}
                  variant={isFastMissed ? "primary" : "secondary"}
                  onPress={onToggleMissed}
                  accessibilityLabel={isFastMissed ? "Clear missed fast" : "Mark fast as missed"}
                  style={styles.markBtn}
                />
              ) : null}
            </GlassSurface>
            </View>
          )}

          {selectedDate ? (
            <>
              <DayDetailPanel
                date={selectedDate}
                isToday={selectedIsToday}
                holiday={selectedHoliday}
                loading={loading}
                prayerTimes={prayerTimes}
                error={error}
                onRetry={retry}
                onOpenSettings={openSettings}
                nextPrayer={nextPrayer}
                timeLeft={timeLeft}
                coords={dialCoords}
                statuses={statuses}
                onPressPrayer={(name, label) => setPrayerSheet({ name, label })}
              />
              <HabitChecklist habits={habits} done={habitDone} date={selectedDate} onToggle={toggleHabit} />
            </>
          ) : (
            <View style={styles.prompt}>
              <AppIcon name="calendar-outline" size={30} color={colors.iconMuted} />
              <Body color={colors.textSecondary} style={styles.promptText}>
                Tap any day to see its prayer times &amp; events.
              </Body>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
    <MonthPickerSheet
      visible={monthPickerOpen}
      viewYear={viewYear}
      viewMonth={viewMonth}
      today={today}
      minDate={minDate}
      maxDate={maxDate}
      onSelect={handleMonthPicked}
      onClose={() => setMonthPickerOpen(false)}
    />
    <PrayerLogSheet
      visible={prayerSheet !== null}
      prayerName={prayerSheet?.name ?? null}
      prayerLabel={prayerSheet?.label ?? ""}
      currentStatus={prayerSheet ? statuses[prayerSheet.name] : undefined}
      onSelect={(s) => { if (prayerSheet) setStatus(prayerSheet.name, s); setPrayerSheet(null); }}
      onClear={() => { if (prayerSheet) clearStatus(prayerSheet.name); setPrayerSheet(null); }}
      onClose={() => setPrayerSheet(null)}
    />
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing } = theme;
  return StyleSheet.create({
    fill: { flex: 1 },
    header: { paddingTop: spacing.sm, marginBottom: spacing.sm },
    monthSwitcher: { flexDirection: "row", alignItems: "center" },
    monthLabel: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.xs },
    weekdayRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    weekdayText: { textAlign: "center" },
    gridWrap: {},
    loadingWrap: { height: 6 * 44, justifyContent: "center", alignItems: "center" },
    weekRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginVertical: spacing.xs,
    },
    dayButton: { justifyContent: "center", alignItems: "center" },
    dayToday: { backgroundColor: colors.accent },
    daySelected: { backgroundColor: withOpacity(colors.accent, 0.18) },
    // Holidays get a dot under the numeral; a ring would read as "selected".
    holidayDot: {
      position: "absolute",
      bottom: 4,
      width: 5,
      height: 5,
      borderRadius: theme.radii.pill,
      backgroundColor: colors.accent,
    },
    dayText: { textAlign: "center" },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: withOpacity(colors.white, 0.12),
      marginTop: spacing.sm,
    },
    panelContent: { paddingTop: spacing.lg },
    backToToday: {
      alignSelf: "center",
      marginBottom: spacing.lg,
    },
    section: { marginBottom: spacing.xxl },
    ramadanCard: { padding: spacing.lg },
    ramadanRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
    ramadanTextWrap: { flexShrink: 1, gap: 2 },
    markBtn: { marginTop: spacing.md },
    prompt: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.huge, gap: spacing.sm },
    promptText: { textAlign: "center", maxWidth: 240 },
  });
};
