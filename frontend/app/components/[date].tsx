import { colors, withOpacity } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  dateKeyFromDate,
  getHolidayMapForYear,
  getHolidaysForYear,
} from "../../services/holidayService";
import {
  getPrayerTimesForDate,
  PrayerSettings,
  PrayerTime,
} from "../../services/prayerTimes";
import {
  clearMissedFast,
  computeRamadanEnd,
  findRamadanStart,
  isInRamadanWindow,
  markFastAsMissed,
  wasFastMissed,
} from "../../services/ramadanTracker";
import getTimeUntil from "../../util/getTimeUntil";
import PrayerTimesList from "../components/PrayerTimesList";
import PressableScale from "../components/PressableScale";
const screenWidth = Dimensions.get("window").width;

type UIError =
  | { code: "PERMISSION"; message: string }
  | { code: "GENERIC"; message: string };

export default function CalendarDetail() {
  const {
    date,
    month,
    year,
    holiday: holidayParam,
    ramadanStart: ramadanStartParam,
    ramadanEnd: ramadanEndParam,
  } = useLocalSearchParams();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [holiday, setHoliday] = useState<string | null>(null);
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<null | {
    label: string;
    time: string;
    dateObj: Date;
  }>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UIError | null>(null);
  const [fetchNonce, setFetchNonce] = useState(0);
  const prayerTimesCacheRef = useRef<Record<string, PrayerTime[]>>({});

  // Ramadan tracking state
  const [isFastMissed, setIsFastMissed] = useState(false);
  const [isRamadan, setIsRamadan] = useState(false);
  const [loadingRamadan, setLoadingRamadan] = useState(false);

  const holidayValue = typeof holidayParam === "string" ? holidayParam : null;
  const hasHolidayParam =
    holidayValue != null && holidayValue.trim().length > 0;

  // retry control for silent spinner mode
  const retryRef = useRef<{
    attempt: number;
    t: ReturnType<typeof setTimeout> | null;
  }>({
    attempt: 0,
    t: null,
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const timesOpacityAnim = useRef(new Animated.Value(1)).current;
  const timesSlideAnim = useRef(new Animated.Value(0)).current;

  // keep refs for current date state so PanResponder callbacks read fresh values
  const selectedDateRef = useRef(selectedDate);
  const isDraggingRef = useRef(false);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const runIncomingAnimation = (direction: "next" | "prev") => {
    const entryOffset = direction === "next" ? screenWidth : -screenWidth;
    slideAnim.setValue(entryOffset);
    timesSlideAnim.setValue(entryOffset);
    fadeAnim.setValue(0);
    timesOpacityAnim.setValue(0);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(timesOpacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(timesSlideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const transitionToDate = (targetDate: Date, direction: "next" | "prev") => {
    const targetKey = dateKeyFromDate(targetDate);
    const cached = prayerTimesCacheRef.current[targetKey];

    setError(null);
    if (cached) {
      setPrayerTimes(cached);
      setLoading(false);
    } else {
      setPrayerTimes([]);
      setLoading(true);
    }

    setSelectedDate(targetDate);
    setFetchNonce((n) => n + 1);
    runIncomingAnimation(direction);
  };

  const snapBackToCenter = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(timesSlideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(timesOpacityAnim, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // PanResponder for horizontal swipes
  const panResponderRef = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dy) < 20,
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
        // stop any ongoing animations
        fadeAnim.stopAnimation();
        slideAnim.stopAnimation();
        timesOpacityAnim.stopAnimation();
        timesSlideAnim.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isDraggingRef.current) return;
        // follow finger for date but not prayer times container
        slideAnim.setValue(gestureState.dx);
        timesSlideAnim.setValue(gestureState.dx);
        // subtle fade while dragging
        const fade =
          1 - Math.min(Math.abs(gestureState.dx) / screenWidth, 0.25);
        fadeAnim.setValue(fade);
        timesOpacityAnim.setValue(fade);
      },
      onPanResponderRelease: (_, gestureState) => {
        isDraggingRef.current = false;
        const dx = gestureState.dx;
        const vx = gestureState.vx;
        const threshold = Math.min(0.25 * screenWidth, 80);

        const currentDate = selectedDateRef.current;
        if (!currentDate) {
          snapBackToCenter();
          return;
        }

        const today = new Date();
        const minDate = new Date(today.getFullYear(), 0);
        const maxDate = new Date(today.getFullYear() + 1, 11, 31);

        // Swipe left (next day)
        if (dx < -threshold || (vx < -0.8 && Math.abs(dx) > 20)) {
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);
          if (nextDate <= maxDate) {
            requestAnimationFrame(() => {
              transitionToDate(nextDate, "next");
            });
            return;
          }
        }
        // Swipe right (previous day)
        else if (dx > threshold || (vx > 0.8 && Math.abs(dx) > 20)) {
          const prevDate = new Date(currentDate);
          prevDate.setDate(prevDate.getDate() - 1);
          if (prevDate >= minDate) {
            requestAnimationFrame(() => {
              transitionToDate(prevDate, "prev");
            });
            return;
          }
        }

        snapBackToCenter();
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        // Snap back
        snapBackToCenter();
      },
    }),
  );

  useEffect(() => {
    if (typeof date === "string") {
      setSelectedDate(new Date(decodeURIComponent(date)));
    }

    // Seed once on entry, never lock it
    if (hasHolidayParam && holidayValue) {
      setHoliday(holidayValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedDate) return;

      try {
        const map = await getHolidayMapForYear(selectedDate.getFullYear());
        const key = dateKeyFromDate(selectedDate);
        const computed = map[key] ?? null;
        if (mounted) setHoliday(computed);
      } catch (e) {
        console.warn("Failed to resolve holiday:", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  // Load Ramadan status and check if date is in Ramadan window
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedDate) return;
      setLoadingRamadan(true);
      try {
        // Load missed fast status for this date
        const missed = await wasFastMissed(selectedDate);

        // Check if we have preloaded Ramadan dates from Calendar screen
        const hasPreloadedDates =
          typeof ramadanStartParam === "string" &&
          ramadanStartParam.length > 0 &&
          typeof ramadanEndParam === "string" &&
          ramadanEndParam.length > 0;

        let ramadanStart: Date | null = null;
        let ramadanEnd: Date | null = null;

        if (hasPreloadedDates) {
          // Use preloaded dates from navigation params
          ramadanStart = new Date(ramadanStartParam as string);
          ramadanEnd = new Date(ramadanEndParam as string);
        } else {
          // Fetch holidays if not preloaded
          const holidays = await getHolidaysForYear(selectedDate.getFullYear());
          ramadanStart = findRamadanStart(holidays);
          if (ramadanStart) {
            ramadanEnd = computeRamadanEnd(ramadanStart);
          }
        }

        if (ramadanStart && ramadanEnd) {
          const inWindow = isInRamadanWindow(
            selectedDate,
            ramadanStart,
            ramadanEnd,
          );
          if (mounted) {
            setIsRamadan(inWindow);
            setIsFastMissed(missed);
          }
        } else {
          if (mounted) {
            setIsRamadan(false);
            setIsFastMissed(false);
          }
        }
      } catch (e) {
        console.warn("Failed to load Ramadan status:", e);
        if (mounted) {
          setIsRamadan(false);
          setIsFastMissed(false);
        }
      } finally {
        if (mounted) setLoadingRamadan(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedDate, ramadanStartParam, ramadanEndParam]);

  const today = new Date();
  const isToday = selectedDate?.toDateString() === today.toDateString();

  // Helpers
  const clearRetry = () => {
    if (retryRef.current.t) clearTimeout(retryRef.current.t);
    retryRef.current.t = null;
  };
  const resetRetry = () => {
    clearRetry();
    retryRef.current.attempt = 0;
  };
  const scheduleRetry = () => {
    const base = 2000; // 2s
    const delay = Math.min(30000, base * Math.pow(2, retryRef.current.attempt)); // cap at 30s
    const jitter = Math.floor(Math.random() * 500); // small jitter
    clearRetry();
    retryRef.current.t = setTimeout(() => {
      setFetchNonce((n) => n + 1);
    }, delay + jitter);
    retryRef.current.attempt += 1;
  };

  const isPermissionError = (e: unknown) => {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as any).message)
        : String(e ?? "");
    return /Location permission not granted/i.test(msg);
  };

  // Treat these as transient and keep spinner up
  const isTransient = (e: unknown) => {
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as any).message)
        : String(e ?? "");
    // do not mention exact cause in UI
    return (
      /Too many requests/i.test(msg) || // service throttling
      /Failed to fetch|Network request failed|NetworkError/i.test(msg)
    );
  };

  // Fetch times for the selected date
  useEffect(() => {
    if (!selectedDate) return;
    let mounted = true;
    const dateKey = dateKeyFromDate(selectedDate);
    const cachedTimes = prayerTimesCacheRef.current[dateKey];
    const hasCachedTimes = Array.isArray(cachedTimes);

    if (hasCachedTimes) {
      setPrayerTimes(cachedTimes);
      setLoading(false);
    } else {
      setPrayerTimes([]);
      setLoading(true);
    }
    setError(null);

    (async () => {
      try {
        const settings: PrayerSettings = { useLocation: true, method: 2 };
        const currentDate = new Date(selectedDate);
        const times = await getPrayerTimesForDate(settings, currentDate);
        if (!mounted) return;

        prayerTimesCacheRef.current[dateKey] = times;
        resetRetry();
        setPrayerTimes(times);
        setLoading(false);

        // Preload adjacent days so swipe transitions can show data immediately.
        const preloadOffsets = [-1, 1];
        preloadOffsets.forEach((offset) => {
          const adjacentDate = new Date(currentDate);
          adjacentDate.setDate(adjacentDate.getDate() + offset);
          const adjacentKey = dateKeyFromDate(adjacentDate);
          if (prayerTimesCacheRef.current[adjacentKey]) return;

          getPrayerTimesForDate(settings, adjacentDate)
            .then((adjacentTimes) => {
              if (adjacentTimes.length > 0) {
                prayerTimesCacheRef.current[adjacentKey] = adjacentTimes;
              }
            })
            .catch(() => {
              // Keep prefetch failures silent; primary date load already succeeded.
            });
        });
      } catch (err) {
        if (!mounted) return;
        console.warn("Prayer times fetch error:", err);

        if (isPermissionError(err)) {
          resetRetry();
          if (!hasCachedTimes) {
            setError({
              code: "PERMISSION",
              message:
                "Location is off. Turn it on in Settings or choose a saved city, then try again.",
            });
            setPrayerTimes([]);
          }
          setLoading(false);
          return;
        }

        if (isTransient(err)) {
          // stay in spinner mode and silently retry until it works
          setError(null);
          setLoading(!hasCachedTimes);
          scheduleRetry();
          return;
        }

        // generic visible error
        resetRetry();
        if (!hasCachedTimes) {
          setError({
            code: "GENERIC",
            message: "Could not load prayer times. Please try again later.",
          });
          setPrayerTimes([]);
        }
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      clearRetry();
    };
    // include nonce so manual retrys happen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, fetchNonce]);

  useEffect(() => {
    if (!isToday || prayerTimes.length === 0) return;
    const now = new Date();
    for (let { label, time } of prayerTimes) {
      const [hoursMinutes, ampm] = time.split(" ");
      const [h, m] = hoursMinutes.split(":");
      let hours = parseInt(h, 10);
      const minutes = parseInt(m, 10);

      if (ampm?.toLowerCase() === "pm" && hours !== 12) hours += 12;
      if (ampm?.toLowerCase() === "am" && hours === 12) hours = 0;

      const dateObj = new Date(today);
      dateObj.setHours(hours, minutes, 0, 0);

      if (dateObj > now) {
        setNextPrayer({ label, time, dateObj });
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, prayerTimes]);

  useEffect(() => {
    if (!nextPrayer) return;
    setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    }, 1000);
    return () => clearInterval(interval);
  }, [nextPrayer]);

  if (!selectedDate) return null;

  const islamicDate = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(selectedDate);

  const minDate = new Date(today.getFullYear(), 0);
  const maxDate = new Date(today.getFullYear() + 1, 11, 31);
  const prevDate = new Date(selectedDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(selectedDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const isPrevDisabled = prevDate < minDate;
  const isNextDisabled = nextDate > maxDate;

  // Transition when changing day
  const animateDateChange = (
    direction: "next" | "prev",
    daysOffset: number,
  ) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + daysOffset);
    transitionToDate(newDate, direction);
  };

  // Smooth fade when going Back to Calendar
  const animateBackToCalendar = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      router.replace(`/Calendar?month=${month}&year=${year}`);
    });
  };

  const formatShort = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const handleRetry = () => {
    resetRetry();
    setFetchNonce((n) => n + 1);
  };

  const openSettings = async () => {
    try {
      if (Platform.OS === "ios") {
        await Linking.openURL("app-settings:");
      } else {
        await Linking.openSettings();
      }
    } catch {}
  };

  // Handle Ramadan missed fast toggle
  const handleMissedFastToggle = async () => {
    if (!selectedDate) return;
    try {
      // Toggle the missed fast status
      if (isFastMissed) {
        await clearMissedFast(selectedDate);
        setIsFastMissed(false);
      } else {
        await markFastAsMissed(selectedDate);
        setIsFastMissed(true);
      }
    } catch (e) {
      console.error("Failed to update missed fast status:", e);
    }
  };

  const ErrorBox = () =>
    !error ? null : (
      <View
        style={{
          backgroundColor: colors.primarySurface,
          borderRadius: 12,
          padding: 14,
          marginTop: 0,
          marginBottom: 14,
          borderWidth: 2,
          borderColor: colors.accent,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="alert-circle" size={20} color={colors.accent} />
          <Text
            style={{
              color: colors.accent,
              fontSize: 16,
              marginLeft: 8,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            Problem loading prayer times
          </Text>
        </View>
        <Text style={{ color: colors.white, marginTop: 8, lineHeight: 20 }}>
          {error.message}
        </Text>

        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}
        >
          <TouchableOpacity
            onPress={handleRetry}
            style={{
              backgroundColor: colors.accent,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 8,
              marginRight: 10,
            }}
          >
            <Text
              style={{
                color: colors.primary,
                fontSize: 14,
                fontFamily: "SFProDisplay-Semibold",
              }}
            >
              Try again
            </Text>
          </TouchableOpacity>

          {error.code === "PERMISSION" && (
            <TouchableOpacity
              onPress={openSettings}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.accent,
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 14,
                  fontFamily: "SFProDisplay-Semibold",
                }}
              >
                Open Settings
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );

  const EmptyBox = () => (
    <View
      style={{
        backgroundColor: colors.primarySurface,
        borderRadius: 12,
        padding: 16,
        marginTop: 0,
        marginBottom: 0,
        borderWidth: 2,
        borderColor: colors.primarySurface,
      }}
    >
      <Text style={{ color: colors.white, textAlign: "center" }}>
        No prayer times available for this date.
      </Text>
      <TouchableOpacity
        onPress={handleRetry}
        style={{
          alignSelf: "center",
          marginTop: 10,
          backgroundColor: colors.accent,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: colors.primary, fontWeight: "600" }}>
          Try again
        </Text>
      </TouchableOpacity>
    </View>
  );

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
        {/* Top Navigation Bar - stays fixed */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            paddingHorizontal: 20,
            paddingTop: 8,
          }}
        >
          <PressableScale
            onPress={animateBackToCalendar}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 10,
              backgroundColor: "transparent",
            }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.accent} />
            <Text
              style={{
                color: colors.accent,
                fontSize: 16,
                fontFamily: "SFProDisplay-Medium",
                marginLeft: 2,
              }}
            >
              Calendar
            </Text>
          </PressableScale>
        </View>

        {/* Content area with proper layout and swipe gesture support */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
          {...panResponderRef.current.panHandlers}
        >
          {/* Static Prev / Next Row (no animation) */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
              gap: 12,
            }}
          >
            {/* Prev */}
            <PressableScale
              onPress={() => !isPrevDisabled && animateDateChange("prev", -1)}
              disabled={isPrevDisabled}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                shadowColor: colors.black,
                shadowOpacity: isPrevDisabled ? 0 : 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: isPrevDisabled ? 0 : 2,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: withOpacity(
                    colors.accent,
                    isPrevDisabled ? 0.05 : 0.12,
                  ),
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={
                    isPrevDisabled
                      ? withOpacity(colors.accent, 0.3)
                      : colors.accent
                  }
                />
              </View>
              <Text
                style={{
                  color: isPrevDisabled
                    ? withOpacity(colors.white, 0.3)
                    : colors.white,
                  fontSize: 13,
                  fontFamily: "SFProDisplay-Medium",
                  marginBottom: 2,
                }}
              >
                Prev
              </Text>
              {!isPrevDisabled && (
                <Text
                  style={{
                    color: withOpacity(colors.white, 0.6),
                    fontSize: 11,
                    fontFamily: "SFProDisplay-Regular",
                  }}
                >
                  {formatShort(prevDate)}
                </Text>
              )}
            </PressableScale>
            <View style={{ height: 78, justifyContent: "center" }}>
              {/* Animated Date Info (only this slides) */}
              <Animated.View
                style={{
                  flex: 2,
                  alignItems: "center",
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderRadius: 16,
                  shadowColor: colors.accent,
                  shadowOpacity: 0.15,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 3,
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                }}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontSize: 18,
                    textAlign: "center",
                    fontFamily: "SFProDisplay-Bold",
                    letterSpacing: 0.5,
                    marginBottom: 6,
                  }}
                >
                  {selectedDate.toDateString()}
                </Text>
                <Text
                  style={{
                    color: colors.accent,
                    fontSize: 14,
                    textAlign: "center",
                    fontFamily: "SFProDisplay-Medium",
                    letterSpacing: 0.3,
                  }}
                >
                  {islamicDate}
                </Text>
              </Animated.View>
            </View>
            {/* Next */}
            <PressableScale
              onPress={() => !isNextDisabled && animateDateChange("next", 1)}
              disabled={isNextDisabled}
              style={{
                flex: 1,
                alignItems: "center",
                paddingVertical: 12,
                paddingHorizontal: 12,
                shadowColor: colors.black,
                shadowOpacity: isNextDisabled ? 0 : 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: isNextDisabled ? 0 : 2,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: withOpacity(
                    colors.accent,
                    isNextDisabled ? 0.05 : 0.12,
                  ),
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={
                    isNextDisabled
                      ? withOpacity(colors.accent, 0.3)
                      : colors.accent
                  }
                />
              </View>
              <Text
                style={{
                  color: isNextDisabled
                    ? withOpacity(colors.white, 0.3)
                    : colors.white,
                  fontSize: 13,
                  fontFamily: "SFProDisplay-Medium",
                  marginBottom: 2,
                }}
              >
                Next
              </Text>
              {!isNextDisabled && (
                <Text
                  style={{
                    color: withOpacity(colors.white, 0.6),
                    fontSize: 11,
                    fontFamily: "SFProDisplay-Regular",
                  }}
                >
                  {formatShort(nextDate)}
                </Text>
              )}
            </PressableScale>
          </View>

          {/* Holiday Box (static) */}
          {holiday && (
            <View
              style={{
                backgroundColor: colors.primarySurface,
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                borderWidth: 2,
                borderColor: colors.accent,
                shadowColor: colors.accent,
                shadowOpacity: 0.6,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 18,
                  textAlign: "center",
                }}
              >
                {holiday}
              </Text>
            </View>
          )}

          {/* Ramadan Tracker Card */}
          {isRamadan && !loadingRamadan && (
            <View
              style={{
                backgroundColor: withOpacity(colors.black, 0.2),
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: withOpacity(colors.white, 0.08),
              }}
            >
              <Text
                style={{
                  color: colors.white,
                  fontSize: 18,
                  fontFamily: "SFProDisplay-Semibold",
                  textAlign: "center",
                  marginBottom: 14,
                }}
              >
                Fasting Status
              </Text>

              <PressableScale
                onPress={handleMissedFastToggle}
                style={{
                  backgroundColor: isFastMissed
                    ? colors.accent
                    : colors.primaryDark,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  borderRadius: 10,
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: isFastMissed
                    ? withOpacity(colors.accent, 0.8)
                    : withOpacity(colors.white, 0.05),
                  shadowColor: isFastMissed
                    ? colors.accent
                    : withOpacity(colors.black, 0.3),
                  shadowOpacity: isFastMissed ? 0.5 : 0.2,
                  shadowRadius: isFastMissed ? 12 : 8,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: isFastMissed ? 8 : 4,
                }}
              >
                <Text
                  style={{
                    color: isFastMissed ? colors.primaryDark : colors.white,
                    fontSize: 16,
                    fontFamily: "SFProDisplay-Semibold",
                  }}
                >
                  Missed Fast
                </Text>
              </PressableScale>
            </View>
          )}

          {/* Section title (static) */}
          <Text
            style={{
              color: colors.white,
              fontSize: 20,
              marginBottom: 10,
              marginTop: 0,
              textAlign: "center",
            }}
          >
            Prayer Times
          </Text>

          {/* Error or Empty states (static) */}
          {error && <ErrorBox />}

          {/* Prayer times container – always mounted and height locked */}
          <View
            style={{
              backgroundColor: withOpacity(colors.black, 0.2),
              borderRadius: 18,
              padding: 20,
              borderWidth: 1,
              borderColor: withOpacity(colors.white, 0.08),
              shadowColor: colors.primaryDark,
              shadowOpacity: 0.25,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 16 },
              elevation: 6,
              overflow: "hidden",
            }}
          >
            {error ? (
              <ErrorBox />
            ) : !loading && prayerTimes.length === 0 ? (
              <EmptyBox />
            ) : (
              <PrayerTimesList
                loading={loading}
                prayerTimes={prayerTimes}
                nextPrayerLabel={nextPrayer?.label ?? null}
                timeOpacity={timesOpacityAnim}
                timeSlide={timesSlideAnim}
              />
            )}
          </View>

          {/* Time until next prayer (static) */}
          {isToday && nextPrayer && !error && (
            <View style={{ marginTop: 10, alignItems: "center" }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>
                Next: {nextPrayer.label} in {timeLeft}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
