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
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import DayDetailPanel from "@/components/calendar/DayDetailPanel";
import PressableScale from "@/components/PressableScale";
import HabitChecklist from "@/components/tracking/HabitChecklist";
import PrayerLogSheet from "@/components/tracking/PrayerLogSheet";
import GlassSurface from "@/components/ui/GlassSurface";
import Screen from "@/components/ui/Screen";
import { Body, Caption, Headline, LargeTitle } from "@/components/ui/Text";
import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { useHaptics } from "@/hooks/useHaptics";
import { useHabitLog } from "@/hooks/useHabitLog";
import { useHabits } from "@/hooks/useHabits";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useCalendarNavigationTransitions } from "@/hooks/useCalendarNavigationTransitions";
import { useCalendarViewState } from "@/hooks/useCalendarViewState";
import { useNextPrayer } from "@/hooks/useNextPrayer";
import { usePrayerLog } from "@/hooks/usePrayerLog";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useRamadanTracker } from "@/hooks/useRamadanTracker";
import { dateKeyFromDate } from "@/services/holidayService";
import type { PrayerName } from "@/services/prayerTracker";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function CalendarScreen() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const haptics = useHaptics();

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
  const tabBarHeight = useBottomTabBarHeight();

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

  return (
    <View style={styles.fill}>
    <Screen>
      <View style={styles.fill}>
        {/* Header: title + bare top-right month switcher */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Caption color={withOpacity(colors.accent, 0.92)} style={styles.eyebrow}>
              Planner
            </Caption>
            <LargeTitle>Calendar</LargeTitle>
          </View>
          <View style={styles.monthSwitcher}>
            <PressableScale
              onPress={handlePrevMonth}
              disabled={!canGoPrev}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              style={styles.monthChevron}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={canGoPrev ? colors.accent : withOpacity(colors.accent, 0.3)}
              />
            </PressableScale>
            <Headline>
              {monthName.slice(0, 3)} {viewYear}
            </Headline>
            <PressableScale
              onPress={handleNextMonth}
              disabled={!canGoNext}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              style={styles.monthChevron}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={canGoNext ? colors.accent : withOpacity(colors.accent, 0.3)}
              />
            </PressableScale>
          </View>
        </View>

        {/* Weekday row */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((d, i) => (
            <Caption
              key={`${d}-${i}`}
              color={colors.accent}
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
            { opacity: fadeAnim, transform: [{ translateX }] },
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
                      onPress={() => selectDay(day)}
                      disabled={navigating || day <= 0}
                      accessibilityRole="button"
                      accessibilityLabel={
                        day > 0 ? `Select ${monthName} ${day}, ${viewYear}` : "Empty day"
                      }
                      style={[
                        styles.dayButton,
                        { width: dayButtonSize, height: dayButtonSize, borderRadius: dayButtonSize / 2 },
                        isToday ? styles.dayToday : isSelected ? styles.daySelected : holidayName ? styles.dayHoliday : null,
                      ]}
                    >
                      <Body
                        color={
                          isToday
                            ? colors.onAccent
                            : isSelected || holidayName
                            ? colors.accent
                            : colors.white
                        }
                        style={styles.dayText}
                      >
                        {day > 0 ? String(day) : ""}
                      </Body>
                    </PressableScale>
                  );
                })}
              </View>
            ))
          )}
        </Animated.View>

        <View style={styles.divider} />

        {/* Scrolling day panel */}
        <ScrollView
          style={styles.fill}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.panelContent,
            { paddingBottom: tabBarHeight + insets.bottom + spacing.lg },
          ]}
        >
          {!isViewingToday && (
            <Animated.View style={{ opacity: backToTodayAnim }}>
              <PressableScale
                onPress={goBackToToday}
                accessibilityRole="button"
                accessibilityLabel="Back to current month"
                style={styles.backToToday}
              >
                <Ionicons name="today-outline" size={15} color={colors.onAccent} />
                <Headline color={colors.onAccent}>
                  Back to Today
                </Headline>
              </PressableScale>
            </Animated.View>
          )}

          {ramadanMonthActive && (
            <GlassSurface tier="card" radius={theme.radii.card} style={styles.ramadanCard}>
              {showRamadanSummary ? (
                <PressableScale
                  onPress={handleRamadanSummaryPress}
                  accessibilityRole="button"
                  accessibilityLabel="Open first missed Ramadan fast date"
                  style={styles.ramadanRow}
                >
                  <View style={styles.ramadanTextWrap}>
                    <Headline color={colors.accent}>Ramadan</Headline>
                    <Body color={colors.white}>
                      {ramadanSummary?.totalMissed ?? 0} missed{" "}
                      {(ramadanSummary?.totalMissed ?? 0) === 1 ? "fast" : "fasts"}
                    </Body>
                    {missedDaysLabel ? (
                      <Caption color={withOpacity(colors.white, 0.85)}>{missedDaysLabel}</Caption>
                    ) : null}
                  </View>
                  <Ionicons name="arrow-forward-circle-outline" size={20} color={withOpacity(colors.accent, 0.95)} />
                </PressableScale>
              ) : (
                <View style={styles.ramadanRow}>
                  <Headline color={colors.accent}>Ramadan</Headline>
                  <Body color={withOpacity(colors.white, 0.7)}>No missed fasts</Body>
                </View>
              )}

              {selectedDate && isRamadan ? (
                <PressableScale
                  onPress={onToggleMissed}
                  accessibilityRole="button"
                  accessibilityLabel={isFastMissed ? "Clear missed fast" : "Mark fast as missed"}
                  style={[styles.markBtn, isFastMissed ? styles.markBtnOn : null]}
                >
                  <Ionicons
                    name={isFastMissed ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={isFastMissed ? colors.onAccent : colors.accent}
                  />
                  <Headline color={isFastMissed ? colors.onAccent : colors.accent}>
                    {isFastMissed
                      ? `Day ${selectedDate.getDate()} · marked missed`
                      : `Mark Day ${selectedDate.getDate()} missed`}
                  </Headline>
                </PressableScale>
              ) : null}
            </GlassSurface>
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
                statuses={statuses}
                onPressPrayer={(name, label) => setPrayerSheet({ name, label })}
              />
              <View style={{ height: spacing.lg }} />
              <HabitChecklist habits={habits} done={habitDone} onToggle={toggleHabit} />
            </>
          ) : (
            <View style={styles.prompt}>
              <Ionicons name="calendar-outline" size={30} color={withOpacity(colors.accent, 0.6)} />
              <Body color={withOpacity(colors.white, 0.7)} style={styles.promptText}>
                Tap any day to see its prayer times &amp; events.
              </Body>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
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
    header: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    headerLeft: { flexShrink: 1 },
    eyebrow: { textTransform: "uppercase", letterSpacing: 1 },
    monthSwitcher: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    monthChevron: { padding: spacing.xs, minWidth: 32, alignItems: "center" },
    weekdayRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.xs,
    },
    weekdayText: { textAlign: "center" },
    gridWrap: { paddingHorizontal: spacing.xl },
    loadingWrap: { height: 6 * 44, justifyContent: "center", alignItems: "center" },
    weekRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginVertical: spacing.xs,
    },
    dayButton: { justifyContent: "center", alignItems: "center" },
    dayToday: {
      backgroundColor: colors.accent,
      shadowColor: colors.accent,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    daySelected: {
      borderWidth: 2,
      borderColor: colors.accent,
      backgroundColor: withOpacity(colors.accent, 0.14),
    },
    dayHoliday: {
      borderWidth: 1.5,
      borderColor: withOpacity(colors.accent, 0.6),
    },
    dayText: { textAlign: "center" },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: withOpacity(colors.white, 0.12),
      marginHorizontal: spacing.xl,
      marginTop: spacing.sm,
    },
    panelContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
    backToToday: {
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: theme.radii.pill,
      marginBottom: spacing.lg,
    },
    ramadanCard: { padding: spacing.lg, marginBottom: spacing.lg },
    ramadanRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    ramadanTextWrap: { flexShrink: 1, gap: 2 },
    markBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      marginTop: spacing.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      borderRadius: theme.radii.row,
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, 0.4),
    },
    markBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
    prompt: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.huge, gap: spacing.sm },
    promptText: { textAlign: "center", maxWidth: 240 },
  });
};
