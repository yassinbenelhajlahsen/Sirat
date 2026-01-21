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
  computeRamadanEnd,
  findRamadanStart,
  getRamadanStatus,
  isInRamadanWindow,
  RamadanStatus,
  setRamadanStatus,
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

  // Ramadan tracking state
  const [ramadanStatus, setRamadanStatusState] = useState<RamadanStatus | null>(
    null,
  );
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
  const prayerTimesAnim = useRef(new Animated.Value(1)).current;
  const prayerTimesSlide = useRef(new Animated.Value(0)).current;

  // keep refs for current date state so PanResponder callbacks read fresh values
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // PanResponder for horizontal swipes
  const panResponderRef = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dy) < 20,
      onPanResponderGrant: () => {
        // stop any ongoing animations
        slideAnim.stopAnimation();
        prayerTimesSlide.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        // follow finger for both date and prayer times
        slideAnim.setValue(gestureState.dx);
        prayerTimesSlide.setValue(gestureState.dx);
        // subtle fade while dragging
        const fade =
          1 - Math.min(Math.abs(gestureState.dx) / screenWidth, 0.25);
        fadeAnim.setValue(fade);
        prayerTimesAnim.setValue(fade);
      },
      onPanResponderRelease: (_, gestureState) => {
        const dx = gestureState.dx;
        const vx = gestureState.vx;
        const threshold = Math.min(0.25 * screenWidth, 80);

        const currentDate = selectedDateRef.current;
        if (!currentDate) return;

        const today = new Date();
        const minDate = new Date(today.getFullYear() - 1, 0);
        const maxDate = new Date(today.getFullYear() + 1, 11, 31);

        // Swipe left (next day)
        if (dx < -threshold || (vx < -0.8 && Math.abs(dx) > 20)) {
          const nextDate = new Date(currentDate);
          nextDate.setDate(nextDate.getDate() + 1);
          if (nextDate <= maxDate) {
            // Trigger next animation
            const offset = -screenWidth;
            Animated.parallel([
              Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 120,
                useNativeDriver: true,
              }),
              Animated.timing(slideAnim, {
                toValue: offset,
                duration: 120,
                useNativeDriver: true,
              }),
              Animated.timing(prayerTimesAnim, {
                toValue: 0,
                duration: 120,
                useNativeDriver: true,
              }),
              Animated.timing(prayerTimesSlide, {
                toValue: offset,
                duration: 120,
                useNativeDriver: true,
              }),
            ]).start(() => {
              // Reset animation values
              fadeAnim.setValue(0);
              slideAnim.setValue(screenWidth);
              prayerTimesAnim.setValue(0);
              prayerTimesSlide.setValue(screenWidth);

              // Update state instead of navigating
              setSelectedDate(nextDate);
              setFetchNonce((n) => n + 1);

              // Animate in the new content
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
                Animated.timing(prayerTimesAnim, {
                  toValue: 1,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(prayerTimesSlide, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start();
            });
            return;
          }
        }
        // Swipe right (previous day)
        else if (dx > threshold || (vx > 0.8 && Math.abs(dx) > 20)) {
          const prevDate = new Date(currentDate);
          prevDate.setDate(prevDate.getDate() - 1);
          if (prevDate >= minDate) {
            // Trigger prev animation
            const offset = screenWidth;
            Animated.parallel([
              Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 120,
                useNativeDriver: true,
              }),
              Animated.timing(slideAnim, {
                toValue: offset,
                duration: 120,
                useNativeDriver: true,
              }),
              Animated.timing(prayerTimesAnim, {
                toValue: 0,
                duration: 120,
                useNativeDriver: true,
              }),
              Animated.timing(prayerTimesSlide, {
                toValue: offset,
                duration: 120,
                useNativeDriver: true,
              }),
            ]).start(() => {
              // Reset animation values
              fadeAnim.setValue(0);
              slideAnim.setValue(-screenWidth);
              prayerTimesAnim.setValue(0);
              prayerTimesSlide.setValue(-screenWidth);

              // Update state instead of navigating
              setSelectedDate(prevDate);
              setFetchNonce((n) => n + 1);

              // Animate in the new content
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
                Animated.timing(prayerTimesAnim, {
                  toValue: 1,
                  duration: 200,
                  useNativeDriver: true,
                }),
                Animated.timing(prayerTimesSlide, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }),
              ]).start();
            });
            return;
          }
        }

        // Snap back to center
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(prayerTimesSlide, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
          Animated.timing(prayerTimesAnim, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        // Snap back
        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(prayerTimesSlide, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(prayerTimesAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start();
      },
    }),
  );

  useEffect(() => {
    if (typeof date === "string") {
      setSelectedDate(new Date(decodeURIComponent(date)));
    }
    if (hasHolidayParam && holidayValue) {
      setHoliday(holidayValue);
    }
  }, [date, holidayValue, hasHolidayParam]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedDate || hasHolidayParam) return;
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
  }, [selectedDate, hasHolidayParam]);

  // Load Ramadan status and check if date is in Ramadan window
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedDate) return;
      setLoadingRamadan(true);
      try {
        // Load status for this date
        const status = await getRamadanStatus(selectedDate);

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
            setRamadanStatusState(status);
          }
        } else {
          if (mounted) {
            setIsRamadan(false);
            setRamadanStatusState(null);
          }
        }
      } catch (e) {
        console.warn("Failed to load Ramadan status:", e);
        if (mounted) {
          setIsRamadan(false);
          setRamadanStatusState(null);
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

    (async () => {
      // Don't show loading state immediately - keep old data visible during transition
      // Only set loading if we don't have any prayer times yet
      if (prayerTimes.length === 0) {
        setLoading(true);
      }
      setError(null);

      try {
        const settings: PrayerSettings = { useLocation: true, method: 2 };
        const times = await getPrayerTimesForDate(settings, selectedDate);
        if (!mounted) return;

        resetRetry();
        setPrayerTimes(times);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        console.warn("Prayer times fetch error:", err);

        if (isPermissionError(err)) {
          resetRetry();
          setError({
            code: "PERMISSION",
            message:
              "Location is off. Turn it on in Settings or choose a saved city, then try again.",
          });
          // Only clear prayer times if we have an error
          setPrayerTimes([]);
          setLoading(false);
          return;
        }

        if (isTransient(err)) {
          // stay in spinner mode and silently retry until it works
          setError(null);
          // Don't clear prayer times on transient errors
          setLoading(prayerTimes.length === 0);
          scheduleRetry();
          return;
        }

        // generic visible error
        resetRetry();
        setError({
          code: "GENERIC",
          message: "Could not load prayer times. Please try again later.",
        });
        // Only clear prayer times if we have an error
        setPrayerTimes([]);
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

  const minDate = new Date(today.getFullYear() - 1, 0);
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
    const offset = direction === "next" ? -screenWidth : screenWidth;
    Animated.parallel([
      // Animate date text
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: offset,
        duration: 120,
        useNativeDriver: true,
      }),
      // Animate prayer times content
      Animated.timing(prayerTimesAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(prayerTimesSlide, {
        toValue: offset,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + daysOffset);

      // Reset animation values
      fadeAnim.setValue(0);
      slideAnim.setValue(direction === "next" ? screenWidth : -screenWidth);
      prayerTimesAnim.setValue(0);
      prayerTimesSlide.setValue(
        direction === "next" ? screenWidth : -screenWidth,
      );

      // Update state instead of navigating
      setSelectedDate(newDate);
      setFetchNonce((n) => n + 1);

      // Animate in the new content
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
        Animated.timing(prayerTimesAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(prayerTimesSlide, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
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

  // Handle Ramadan status change
  const handleRamadanStatusChange = async (status: RamadanStatus) => {
    if (!selectedDate) return;
    try {
      await setRamadanStatus(selectedDate, status);
      setRamadanStatusState(status);
    } catch (e) {
      console.error("Failed to update Ramadan status:", e);
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
        source={require("@/assets/patterns/islamic-gold.png")}
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
        <View
          style={{ flex: 1, padding: 20 }}
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
                opacity: isPrevDisabled ? 0.4 : 1,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: withOpacity(colors.accent, 0.12),
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.accent} />
              </View>
              <Text
                style={{
                  color: colors.white,
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
                opacity: isNextDisabled ? 0.4 : 1,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: withOpacity(colors.accent, 0.12),
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 6,
                }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.accent}
                />
              </View>
              <Text
                style={{
                  color: colors.white,
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
                Fast Status
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  justifyContent: "center",
                }}
              >
                <PressableScale
                  onPress={() => handleRamadanStatusChange("fasted")}
                  style={{
                    flex: 1,
                    backgroundColor:
                      ramadanStatus === "fasted"
                        ? colors.accent
                        : colors.primaryDark,
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 10,
                    alignItems: "center",
                    borderWidth: 2,
                    borderColor:
                      ramadanStatus === "fasted"
                        ? withOpacity(colors.accent, 0.8)
                        : withOpacity(colors.white, 0.05),
                    shadowColor:
                      ramadanStatus === "fasted"
                        ? colors.accent
                        : withOpacity(colors.black, 0.3),
                    shadowOpacity: ramadanStatus === "fasted" ? 0.5 : 0.2,
                    shadowRadius: ramadanStatus === "fasted" ? 12 : 8,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: ramadanStatus === "fasted" ? 8 : 4,
                  }}
                >
                  <Text
                    style={{
                      color:
                        ramadanStatus === "fasted"
                          ? colors.primaryDark
                          : colors.white,
                      fontSize: 16,
                      fontFamily: "SFProDisplay-Semibold",
                    }}
                  >
                    Fasted
                  </Text>
                </PressableScale>

                <PressableScale
                  onPress={() => handleRamadanStatusChange("not_fasted")}
                  style={{
                    flex: 1,
                    backgroundColor:
                      ramadanStatus === "not_fasted"
                        ? colors.accent
                        : colors.primaryDark,
                    paddingVertical: 12,
                    paddingHorizontal: 20,
                    borderRadius: 10,
                    alignItems: "center",
                    borderWidth: 2,
                    borderColor:
                      ramadanStatus === "not_fasted"
                        ? withOpacity(colors.accent, 0.8)
                        : withOpacity(colors.white, 0.05),
                    shadowColor:
                      ramadanStatus === "not_fasted"
                        ? colors.accent
                        : withOpacity(colors.black, 0.3),
                    shadowOpacity: ramadanStatus === "not_fasted" ? 0.5 : 0.2,
                    shadowRadius: ramadanStatus === "not_fasted" ? 12 : 8,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: ramadanStatus === "not_fasted" ? 8 : 4,
                  }}
                >
                  <Text
                    style={{
                      color:
                        ramadanStatus === "not_fasted"
                          ? colors.primaryDark
                          : colors.white,
                      fontSize: 16,
                      fontFamily: "SFProDisplay-Semibold",
                    }}
                  >
                    Not Fasted
                  </Text>
                </PressableScale>
              </View>
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
            <Animated.View
              style={{
                opacity: prayerTimesAnim,
                transform: [{ translateX: prayerTimesSlide }],
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
                />
              )}
            </Animated.View>
          </View>

          {/* Time until next prayer (static) */}
          {isToday && nextPrayer && !error && (
            <View style={{ marginTop: 10, alignItems: "center" }}>
              <Text style={{ color: colors.accent, fontSize: 16 }}>
                Next: {nextPrayer.label} in {timeLeft}
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
