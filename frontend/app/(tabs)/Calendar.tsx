import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PressableScale from "../../components/PressableScale";
import {
  dateKeyFromDate,
} from "../../services/holidayService";
import { useCalendarData } from "../../hooks/useCalendarData";
import { useCalendarNavigationTransitions } from "../../hooks/useCalendarNavigationTransitions";
import { useCalendarSummaryTransition } from "../../hooks/useCalendarSummaryTransition";
import { useCalendarViewState } from "../../hooks/useCalendarViewState";

export default function CalendarScreen() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const router = useRouter();
  const { month, year } = useLocalSearchParams();
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
    visibleMatrix,
    monthName,
  } = useCalendarViewState({
    monthParam: month,
    yearParam: year,
    isSmall,
  });
  const {
    holidayMap,
    loadingHolidays,
    ramadanStart,
    ramadanEnd,
    ramadanSummary,
    firstMissedFastDate,
    missedDaysLabel,
    showRamadanSummary,
  } = useCalendarData(viewYear, viewMonth);
  const { ramadanSummaryAnim, renderRamadanSummary } =
    useCalendarSummaryTransition(showRamadanSummary);
  const {
    navigating,
    setNavigating,
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

  // Animate fade-out before navigating to date details
  const handleDatePress = (selectedDate: Date, holidayName?: string) => {
    if (navigating) return; // prevent double-press
    setNavigating(true);

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 140,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        // delay slightly to ensure animation finishes visually
        setTimeout(() => {
          router.push({
            pathname: "/[date]",
            params: {
              date: selectedDate.toISOString(),
              month: viewMonth.toString(),
              year: viewYear.toString(),
              holiday: holidayName || "",
              ramadanStart: ramadanStart?.toISOString() || "",
              ramadanEnd: ramadanEnd?.toISOString() || "",
            },
          });
          // do NOT reset fadeAnim immediately; let new screen take over
          setNavigating(false);
        }, 50);
      }
    });
  };
  const handleRamadanSummaryPress = useCallback(() => {
    if (!firstMissedFastDate || navigating) return;
    router.push({
      pathname: "/[date]",
      params: {
        date: firstMissedFastDate.toISOString(),
        month: firstMissedFastDate.getMonth().toString(),
        year: firstMissedFastDate.getFullYear().toString(),
        holiday: "",
        ramadanStart: ramadanStart?.toISOString() || "",
        ramadanEnd: ramadanEnd?.toISOString() || "",
      },
    });
  }, [firstMissedFastDate, navigating, ramadanEnd, ramadanStart, router]);

  return (
    <LinearGradient
      colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.screen}
    >
      <Image
        source={require("@/assets/patterns/islamic-gold2.png")}
        style={styles.patternOverlay}
      />
      <SafeAreaView style={styles.screen}>
        {/* Header + Month Navigation: static so arrows and title don't move on swipe */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Planner</Text>
          <Text style={[styles.title, isSmall ? styles.titleSmall : undefined]}>
            Calendar
          </Text>
          <Text style={styles.subtitle}>
            Track important days and Ramadan progress.
          </Text>

          <View style={styles.monthNav}>
            <PressableScale
              onPress={goToPreviousMonth}
              disabled={!canGoPrev}
              style={[
                styles.navIconButton,
                !canGoPrev ? styles.navIconButtonDisabled : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={canGoPrev ? colors.accent : colors.grayDark}
              />
            </PressableScale>

            <Text style={styles.monthLabel}>
              {monthName} {viewYear}
            </Text>

            <PressableScale
              onPress={goToNextMonth}
              disabled={!canGoNext}
              style={[
                styles.navIconButton,
                !canGoNext ? styles.navIconButtonDisabled : undefined,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={canGoNext ? colors.accent : colors.grayDark}
              />
            </PressableScale>
          </View>
        </View>

        {/* Day of week header (static, not animated) */}
        <View style={styles.weekdayRow}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <Text
              key={`${d}-${i}`}
              style={[styles.weekdayText, { width: dayButtonSize }]}
            >
              {d}
            </Text>
          ))}
        </View>

        {/* Animated calendar grid (swipe + slide animations applied here only) */}
        <Animated.View
          {...panHandlers}
          style={{
            flex: 1,
            paddingHorizontal: spacing.lg,
            opacity: fadeAnim,
            transform: [
              {
                translateX: translateX,
              },
              {
                scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.98, 1],
                }),
              },
            ],
          }}
        >
          {/* Calendar Grid */}
          <View style={styles.gridContainer}>
            {loadingHolidays ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : (
              <View style={styles.gridBody}>
                {visibleMatrix.map((week, i) => (
                  <View key={i} style={styles.weekRow}>
                    {week.map((day, j) => {
                      const isToday =
                        day === today.getDate() &&
                        viewMonth === today.getMonth() &&
                        viewYear === today.getFullYear();

                      let holidayName: string | null = null;
                      if (day > 0) {
                        const dateObj = new Date(viewYear, viewMonth, day);
                        const key = dateKeyFromDate(dateObj);
                        holidayName = holidayMap[key] ?? null;
                      }

                      const isHoliday = !!holidayName;

                      return (
                        <PressableScale
                          key={j}
                          onPress={() => {
                            if (day > 0) {
                              const selectedDate = new Date(
                                viewYear,
                                viewMonth,
                                day,
                              );
                              handleDatePress(selectedDate, holidayName || "");
                            }
                          }}
                          disabled={navigating}
                          style={[
                            styles.dayButton,
                            {
                              width: dayButtonSize,
                              height: dayButtonSize,
                              borderRadius: dayButtonSize / 2,
                            },
                            isToday
                              ? styles.dayButtonToday
                              : isHoliday
                                ? styles.dayButtonHoliday
                                : undefined,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={
                            day > 0
                              ? `Open ${monthName} ${day}, ${viewYear}`
                              : "Empty day"
                          }
                        >
                          <Text
                            style={[
                              styles.dayText,
                              isSmall ? styles.dayTextSmall : undefined,
                              isToday
                                ? styles.dayTextToday
                                : isHoliday
                                  ? styles.dayTextHoliday
                                  : undefined,
                            ]}
                          >
                            {day > 0 ? day : ""}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        </Animated.View>

        {/* Ramadan Summary */}
        <View style={[styles.footer, { paddingBottom: tabBarHeight + 8 }]}>
          {renderRamadanSummary && (
            <Animated.View
              pointerEvents={showRamadanSummary ? "auto" : "none"}
              style={{
                opacity: ramadanSummaryAnim,
                marginBottom: ramadanSummaryAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, spacing.lg],
                }),
                maxHeight: ramadanSummaryAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 180],
                }),
                transform: [
                  {
                    scale: ramadanSummaryAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
                overflow: "hidden",
              }}
            >
              <PressableScale
                onPress={handleRamadanSummaryPress}
                style={styles.summaryCard}
                accessibilityRole="button"
                accessibilityLabel="Open first missed Ramadan fast date"
              >
                <View style={styles.summaryTopRow}>
                  <Text style={styles.summaryTitle}>Ramadan Summary</Text>
                  <Ionicons
                    name="arrow-forward-circle-outline"
                    size={20}
                    color={withOpacity(colors.accent, 0.95)}
                  />
                </View>
                <Text style={styles.summaryText}>
                  Missed fasts: {ramadanSummary?.totalMissed ?? 0}
                </Text>
                <Text style={styles.summaryTextSecondary}>
                  Missed days: {missedDaysLabel}
                </Text>
                <Text style={styles.summaryHint}>Tap to review and update</Text>
              </PressableScale>
            </Animated.View>
          )}

          {/* Back to Today */}
          <Animated.View
            pointerEvents={isViewingToday ? "none" : "auto"}
            style={[
              styles.backToTodayWrap,
              {
                height: backToTodayAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 56],
                }),
                marginTop: backToTodayAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, spacing.sm],
                }),
                marginBottom: backToTodayAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, spacing.sm],
                }),
                opacity: backToTodayAnim,
                transform: [
                  {
                    translateY: backToTodayAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <PressableScale
              disabled={isViewingToday}
              onPress={goBackToToday}
              style={styles.backToToday}
              accessibilityRole="button"
              accessibilityLabel="Back to current month"
            >
              <Text style={styles.backToTodayText}>Back to Today</Text>
            </PressableScale>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, typography } = theme;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    screen: { flex: 1 },
    patternOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.05,
      resizeMode: "repeat",
      width: "100%",
      height: "100%",
    },
    header: { padding: spacing.lg },
    eyebrow: {
      color: withOpacity(colors.accent, 0.92),
      fontSize: typography.caption,
      fontFamily: "SFProDisplay-Semibold",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    title: {
      color: colors.white,
      fontFamily: "SFProDisplay-Bold",
      fontSize: 38,
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    titleSmall: { fontSize: 34 },
    subtitle: {
      color: withOpacity(colors.white, 0.88),
      fontFamily: "SFProDisplay-Regular",
      fontSize: typography.body,
      marginBottom: spacing.md,
    },
    monthNav: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.sm,
    },
    navIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    navIconButtonDisabled: {
      opacity: 0.6,
    },
    monthLabel: {
      color: colors.white,
      fontSize: typography.title,
      fontFamily: "SFProDisplay-Semibold",
    },
    weekdayRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    weekdayText: {
      color: colors.accent,
      fontSize: typography.body,
      fontFamily: "SFProDisplay-Regular",
      textAlign: "center",
    },
    gridContainer: { flex: 1, justifyContent: "flex-start" },
    loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center" },
    gridBody: { flexGrow: 1, justifyContent: "space-evenly" },
    weekRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginVertical: spacing.xs,
    },
    dayButton: {
      justifyContent: "center",
      alignItems: "center",
    },
    dayButtonToday: {
      backgroundColor: theme.name === "light" ? "#DABA69" : colors.accent,
      shadowColor: colors.accent,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    dayButtonHoliday: {
      backgroundColor:
        theme.name === "light" ? "#E2CEB1" : colors.primaryBorder,
      borderColor: theme.name === "light" ? "#DABA69" : colors.accent,
      borderWidth: 1.5,
    },
    dayText: {
      color: colors.white,
      fontFamily: "SFProDisplay-Regular",
      fontSize: typography.bodyLg,
    },
    dayTextSmall: {
      fontSize: typography.body,
    },
    dayTextToday: {
      color: colors.onAccent,
      fontFamily: "SFProDisplay-Semibold",
    },
    dayTextHoliday: {
      color: colors.accent,
      fontFamily: "SFProDisplay-Semibold",
    },
    footer: {
      paddingHorizontal: spacing.lg,
    },
    summaryCard: {
      backgroundColor: isLight
        ? withOpacity(colors.primarySurfaceAlt, 0.3)
        : withOpacity(colors.black, 0.25),
      borderRadius: isLight ? 16 : 12,
      padding: spacing.md + 2,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: withOpacity(colors.accent, isLight ? 0.35 : 0.3),
      shadowColor: colors.primaryDark,
      shadowOpacity: isLight ? 0.22 : 0,
      shadowRadius: isLight ? 20 : 0,
      shadowOffset: { width: 0, height: isLight ? 10 : 0 },
      elevation: isLight ? 4 : 0,
    },
    summaryTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xs + 2,
    },
    summaryTitle: {
      color: colors.accent,
      fontSize: typography.bodyLg,
      fontFamily: "SFProDisplay-Semibold",
    },
    summaryText: {
      color: colors.white,
      fontSize: typography.body,
      fontFamily: "SFProDisplay-Semibold",
    },
    summaryTextSecondary: {
      color: withOpacity(colors.white, 0.88),
      fontSize: typography.body,
      fontFamily: "SFProDisplay-Regular",
      marginTop: spacing.xs,
    },
    summaryHint: {
      color: withOpacity(colors.accent, 0.92),
      fontSize: typography.caption,
      fontFamily: "SFProDisplay-Semibold",
      marginTop: spacing.sm,
    },
    backToTodayWrap: {
      overflow: "hidden",
    },
    backToToday: {
      alignSelf: "center",
      backgroundColor: isLight
        ? withOpacity(colors.primarySurfaceAlt, 0.3)
        : colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm + 2,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: isLight
        ? withOpacity(colors.accent, 0.35)
        : withOpacity(colors.white, 0.15),
      shadowColor: colors.primaryDark,
      shadowOpacity: isLight ? 0.22 : 0,
      shadowRadius: isLight ? 20 : 0,
      shadowOffset: { width: 0, height: isLight ? 10 : 0 },
      elevation: isLight ? 4 : 0,
    },
    backToTodayText: {
      color: isLight ? colors.accent : colors.onAccent,
      fontSize: typography.bodyLg,
      fontFamily: "SFProDisplay-Semibold",
    },
  });
};
