import { withOpacity, type AppTheme } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  PanResponder,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  dateKeyFromDate,
  getHolidayMapForYear,
  getHolidaysForYear,
} from "../../services/holidayService";
import {
  computeRamadanEnd,
  findRamadanStart,
  getMissedFastDays,
  getRamadanPeriodSummary,
  isInRamadanWindow,
} from "../../services/ramadanTracker";
import PressableScale from "../components/PressableScale";

const getMonthMatrix = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay();
  const numDays = new Date(year, month + 1, 0).getDate();

  const weeks: number[][] = [];
  let day = 1 - firstDay;
  for (let i = 0; i < 6; i++) {
    const week: number[] = [];
    for (let j = 0; j < 7; j++) {
      week.push(day > 0 && day <= numDays ? day : 0);
      day++;
    }
    weeks.push(week);
  }
  return weeks;
};

function parseDateKey(dateStr: string): Date | null {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export default function CalendarScreen() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);

  const router = useRouter();
  const today = new Date();
  const { month, year } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const initialMonth =
    typeof month === "string" ? parseInt(month, 10) : today.getMonth();
  const initialYear =
    typeof year === "string" ? parseInt(year, 10) : today.getFullYear();
  const initialIsViewingToday =
    initialMonth === today.getMonth() && initialYear === today.getFullYear();

  const minDate = new Date(today.getFullYear(), 0);
  const maxDate = new Date(today.getFullYear() + 1, 11);

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Ramadan tracking state
  const [missedFastsMap, setMissedFastsMap] = useState<Record<string, boolean>>(
    {},
  );
  const [ramadanMonthActive, setRamadanMonthActive] = useState(false);
  const [ramadanStart, setRamadanStart] = useState<Date | null>(null);
  const [ramadanEnd, setRamadanEnd] = useState<Date | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const ramadanSummaryAnim = useRef(new Animated.Value(0)).current;
  const backToTodayAnim = useRef(
    new Animated.Value(initialIsViewingToday ? 0 : 1),
  ).current;
  const { width: screenWidth } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();

  // keep refs for current viewMonth/viewYear so PanResponder callbacks read fresh values
  const viewMonthRef = useRef(viewMonth);
  const viewYearRef = useRef(viewYear);
  useEffect(() => {
    viewMonthRef.current = viewMonth;
    viewYearRef.current = viewYear;
  }, [viewMonth, viewYear]);

  const isViewingToday =
    viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const canGoPrev = new Date(viewYear, viewMonth - 1) >= minDate;
  const canGoNext = new Date(viewYear, viewMonth + 1) <= maxDate;
  const dayButtonSize = isSmall ? 34 : 40;

  const matrix = useMemo(
    () => getMonthMatrix(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
  const visibleMatrix = useMemo(() => {
    let lastWeekWithDates = matrix.length - 1;
    while (
      lastWeekWithDates >= 0 &&
      matrix[lastWeekWithDates].every((day) => day === 0)
    ) {
      lastWeekWithDates -= 1;
    }

    return matrix.slice(0, Math.max(lastWeekWithDates + 1, 1));
  }, [matrix]);
  const monthName = useMemo(
    () =>
      new Date(viewYear, viewMonth).toLocaleString("default", {
        month: "long",
      }),
    [viewYear, viewMonth],
  );

  // Compute Ramadan summary for the entire Ramadan period
  const ramadanSummary = useMemo(() => {
    if (!ramadanMonthActive || !ramadanStart || !ramadanEnd) return null;
    return getRamadanPeriodSummary(missedFastsMap, ramadanStart, ramadanEnd);
  }, [missedFastsMap, ramadanMonthActive, ramadanStart, ramadanEnd]);
  const firstMissedFastDate = useMemo(() => {
    if (!ramadanMonthActive || !ramadanStart || !ramadanEnd) return null;

    const windowStart = new Date(ramadanStart);
    windowStart.setDate(windowStart.getDate() - 3);
    windowStart.setHours(0, 0, 0, 0);

    const windowEnd = new Date(ramadanEnd);
    windowEnd.setDate(windowEnd.getDate() + 3);
    windowEnd.setHours(0, 0, 0, 0);

    const earliestDateKey = Object.entries(missedFastsMap)
      .filter(([, isMissed]) => isMissed)
      .map(([dateKey]) => dateKey)
      .sort()
      .find((dateKey) => {
        const parsed = parseDateKey(dateKey);
        if (!parsed) return false;
        parsed.setHours(0, 0, 0, 0);
        return parsed >= windowStart && parsed <= windowEnd;
      });

    return earliestDateKey ? parseDateKey(earliestDateKey) : null;
  }, [missedFastsMap, ramadanMonthActive, ramadanStart, ramadanEnd]);
  const missedDaysLabel = useMemo(() => {
    if (!ramadanSummary || ramadanSummary.missedDays.length === 0) return "";
    return ramadanSummary.missedDays.join(", ");
  }, [ramadanSummary]);
  const showRamadanSummary =
    !!ramadanSummary &&
    ramadanSummary.totalMissed > 0 &&
    !!firstMissedFastDate;
  const [renderRamadanSummary, setRenderRamadanSummary] = useState(
    showRamadanSummary,
  );

  useEffect(() => {
    if (showRamadanSummary) {
      setRenderRamadanSummary(true);
      ramadanSummaryAnim.setValue(0);
      Animated.timing(ramadanSummaryAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }

    if (!renderRamadanSummary) return;

    Animated.timing(ramadanSummaryAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setRenderRamadanSummary(false);
    });
  }, [renderRamadanSummary, ramadanSummaryAnim, showRamadanSummary]);

  useEffect(() => {
    Animated.timing(backToTodayAnim, {
      toValue: isViewingToday ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [backToTodayAnim, isViewingToday]);

  // Load holidays for the visible year
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingHolidays(true);
      try {
        const map = await getHolidayMapForYear(viewYear);
        if (mounted) setHolidayMap(map);
      } catch (err) {
        console.error("Failed to load holidays:", err);
        if (mounted) setHolidayMap({});
      } finally {
        if (mounted) setLoadingHolidays(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [viewYear]);

  // Load Ramadan data and check if current month is in Ramadan window
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Load Ramadan tracker data
        const map = await getMissedFastDays();
        if (mounted) setMissedFastsMap(map);

        // Check if current month is in Ramadan window
        const holidays = await getHolidaysForYear(viewYear);
        const startDate = findRamadanStart(holidays);

        if (startDate) {
          const endDate = computeRamadanEnd(startDate);
          const firstOfMonth = new Date(viewYear, viewMonth, 1);
          const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);

          // Month is "Ramadan active" if any day in the month is in window
          const monthInWindow =
            isInRamadanWindow(firstOfMonth, startDate, endDate) ||
            isInRamadanWindow(lastOfMonth, startDate, endDate);

          if (mounted) {
            setRamadanMonthActive(monthInWindow);
            setRamadanStart(startDate);
            setRamadanEnd(endDate);
          }
        } else {
          if (mounted) {
            setRamadanMonthActive(false);
            setRamadanStart(null);
            setRamadanEnd(null);
          }
        }
      } catch (e) {
        console.warn("Failed to load Ramadan data:", e);
        if (mounted) {
          setMissedFastsMap({});
          setRamadanMonthActive(false);
          setRamadanStart(null);
          setRamadanEnd(null);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [viewYear, viewMonth]);

  // Reload Ramadan map when returning to Calendar (after marking a day)
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const map = await getMissedFastDays();
          setMissedFastsMap(map);
        } catch (e) {
          console.warn("Failed to reload Ramadan map on focus:", e);
        }
      })();
    }, []),
  );

  // Slide + fade animation helper. dir = 1 => next month (slide left), dir = -1 => previous month (slide right)
  const animateSlideChange = (
    dir: 1 | -1,
    targetYear: number,
    targetMonth: number,
  ) => {
    // if already animating, ignore
    if (navigating) return;
    setNavigating(true);

    // slide out in the swipe direction + slight fade
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -dir * screenWidth,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0.9,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // set new month/year
      setViewYear(targetYear);
      setViewMonth(targetMonth);

      // prepare incoming position (opposite side) and animate back to center
      translateX.setValue(dir * screenWidth);
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setNavigating(false);
      });
    });
  };

  // Updated button handlers to use slide animation
  const goToPreviousMonth = () => {
    const prev = new Date(viewYear, viewMonth - 1);
    if (prev >= minDate) {
      animateSlideChange(-1, prev.getFullYear(), prev.getMonth());
    }
  };

  const goToNextMonth = () => {
    const next = new Date(viewYear, viewMonth + 1);
    if (next <= maxDate) {
      animateSlideChange(1, next.getFullYear(), next.getMonth());
    }
  };

  // PanResponder for horizontal swipes
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dy) < 20,
      onPanResponderGrant: () => {
        // stop any ongoing animations and use translateX directly
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        // follow finger
        translateX.setValue(gestureState.dx);
        // subtle fade while dragging
        const fade =
          1 - Math.min(Math.abs(gestureState.dx) / screenWidth, 0.25);
        fadeAnim.setValue(fade);
      },
      onPanResponderRelease: (_, gestureState) => {
        const dx = gestureState.dx;
        const vx = gestureState.vx;
        const threshold = Math.min(0.25 * screenWidth, 80); // threshold to trigger
        // determine direction: left swipe (next) if dx < -threshold OR high left velocity
        if (dx < -threshold || (vx < -0.8 && Math.abs(dx) > 20)) {
          // next month
          const currentYear = viewYearRef.current;
          const currentMonth = viewMonthRef.current;
          const next = new Date(currentYear, currentMonth + 1);
          if (next <= maxDate) {
            animateSlideChange(1, next.getFullYear(), next.getMonth());
            return;
          }
        } else if (dx > threshold || (vx > 0.8 && Math.abs(dx) > 20)) {
          // previous month
          const currentYear = viewYearRef.current;
          const currentMonth = viewMonthRef.current;
          const prev = new Date(currentYear, currentMonth - 1);
          if (prev >= minDate) {
            animateSlideChange(-1, prev.getFullYear(), prev.getMonth());
            return;
          }
        }

        // otherwise snap back to center
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: 0,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        // snap back
        Animated.timing(translateX, {
          toValue: 0,
          duration: 160,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

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
            pathname: "/components/[date]",
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
      pathname: "/components/[date]",
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
          <Text style={styles.eyebrow}>
            Planner
          </Text>
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
          {...panResponder.panHandlers}
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
                  <Text style={styles.summaryTitle}>
                    Ramadan Summary
                  </Text>
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
                <Text style={styles.summaryHint}>
                  Tap to review and update
                </Text>
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
              onPress={() => {
                const targetYear = today.getFullYear();
                const targetMonth = today.getMonth();
                if (targetYear === viewYear && targetMonth === viewMonth)
                  return;
                const targetDate = new Date(targetYear, targetMonth);
                const currentDate = new Date(viewYear, viewMonth);
                const dir = targetDate > currentDate ? 1 : -1;
                animateSlideChange(dir, targetYear, targetMonth);
              }}
              style={styles.backToToday}
              accessibilityRole="button"
              accessibilityLabel="Back to current month"
            >
              <Text style={styles.backToTodayText}>
                Back to Today
              </Text>
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
    backgroundColor: theme.name === "light" ? "#E2CEB1" : colors.primaryBorder, 
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
