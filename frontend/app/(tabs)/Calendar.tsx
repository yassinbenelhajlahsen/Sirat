import { colors, withOpacity } from "@/constants/theme";
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

export default function CalendarScreen() {
  const router = useRouter();
  const today = new Date();
  const { month, year } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;
  const initialMonth =
    typeof month === "string" ? parseInt(month, 10) : today.getMonth();
  const initialYear =
    typeof year === "string" ? parseInt(year, 10) : today.getFullYear();

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

  const matrix = useMemo(
    () => getMonthMatrix(viewYear, viewMonth),
    [viewYear, viewMonth],
  );
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

  return (
    <LinearGradient
      colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <Image
        source={require("@/assets/patterns/islamic-gold2.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.05,
          resizeMode: "repeat",
          width: "100%",
          height: "100%",
        }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header + Month Navigation: static so arrows and title don't move on swipe */}
        <View style={{ padding: 16 }}>
          <Text
            style={{
              color: colors.white,
              fontFamily: "SFProDisplay-Bold",
              fontSize: isSmall ? 34 : 40,
              marginBottom: 20,
            }}
          >
            Calendar
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <PressableScale
              onPress={goToPreviousMonth}
              disabled={new Date(viewYear, viewMonth - 1) < minDate}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={
                  new Date(viewYear, viewMonth - 1) < minDate
                    ? colors.grayDark
                    : colors.accent
                }
              />
            </PressableScale>

            <Text
              style={{
                color: colors.white,
                fontSize: 22,
                fontFamily: "SFProDisplay-Semibold",
              }}
            >
              {monthName} {viewYear}
            </Text>

            <PressableScale
              onPress={goToNextMonth}
              disabled={new Date(viewYear, viewMonth + 1) > maxDate}
            >
              <Ionicons
                name="chevron-forward"
                size={28}
                color={
                  new Date(viewYear, viewMonth + 1) > maxDate
                    ? colors.grayDark
                    : colors.accent
                }
              />
            </PressableScale>
          </View>
        </View>

        {/* Day of week header (static, not animated) */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            marginTop: 12,
          }}
        >
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <Text
              key={`${d}-${i}`}
              style={{
                color: colors.accent,
                fontSize: 16,
                fontFamily: "SFProDisplay-Regular",
                width: 32,
                textAlign: "center",
              }}
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
            paddingHorizontal: 16,
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
          <View style={{ flex: 1, justifyContent: "flex-start" }}>
            {loadingHolidays ? (
              <View style={{ marginTop: 30, alignItems: "center" }}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : (
              <View
                style={{
                  flexGrow: 1,
                  justifyContent: "space-evenly",
                  marginTop: 8,
                }}
              >
                {matrix.map((week, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginVertical: 4,
                    }}
                  >
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
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: isToday
                              ? colors.accent
                              : isHoliday
                                ? colors.primaryBorder
                                : "transparent",
                            borderColor: isHoliday
                              ? colors.accent
                              : "transparent",
                            borderWidth: isHoliday ? 2 : 0,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: isToday
                                ? colors.primaryDark
                                : isHoliday
                                  ? colors.accent
                                  : colors.white,
                              fontFamily: "SFProDisplay-Regular",
                              fontSize: 16,
                            }}
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

        {/* Ramadan Summary (static, not animated) */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: tabBarHeight + 8,
          }}
        >
          {ramadanSummary && ramadanSummary.totalMissed > 0 && (
            <View
              style={{
                backgroundColor: withOpacity(colors.black, 0.25),
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: withOpacity(colors.accent, 0.3),
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 14,
                  fontFamily: "SFProDisplay-Semibold",
                  marginBottom: 6,
                }}
              >
                Ramadan Summary
              </Text>
              <Text
                style={{
                  color: colors.white,
                  fontSize: 13,
                  fontFamily: "SFProDisplay-Regular",
                }}
              >
                Missed: {ramadanSummary.totalMissed}
              </Text>
              <Text
                style={{
                  color: colors.white,
                  fontSize: 13,
                  fontFamily: "SFProDisplay-Regular",
                  marginTop: 2,
                }}
              >
                Days: {ramadanSummary.missedDays.join(", ")}
              </Text>
            </View>
          )}

          {/* Back to Today (static, not animated) */}
          {!isViewingToday && (
            <PressableScale
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
              style={{
                marginTop: 8,
                marginBottom: 24,
                alignSelf: "center",
                backgroundColor: colors.accent,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 20,
              }}
            >
              <Text
                style={{
                  color: colors.primaryDark,
                  fontSize: 16,
                  fontFamily: "SFProDisplay-Semibold",
                }}
              >
                Back to Today
              </Text>
            </PressableScale>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
