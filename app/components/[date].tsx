import { colors as themeColors } from "@/app/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  dateKeyFromDate,
  getHolidayMapForYear,
} from "../../services/holidayService";
import {
  getPrayerTimesForDate,
  PrayerSettings,
  PrayerTime,
} from "../../services/prayerTimes";
import getTimeUntil from "../../util/getTimeUntil";
import PrayerTimesList from "../components/PrayerTimesList";

const screenWidth = Dimensions.get("window").width;

type UIError =
  | { code: "PERMISSION"; message: string }
  | { code: "GENERIC"; message: string };

export default function CalendarDetail() {
  const { date, month, year, holiday: holidayParam } = useLocalSearchParams();
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
      setLoading(true);
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
          setPrayerTimes([]);
          setLoading(false);
          return;
        }

        if (isTransient(err)) {
          // stay in spinner mode and silently retry until it works
          setError(null);
          setPrayerTimes([]);
          setLoading(true);
          scheduleRetry();
          return;
        }

        // generic visible error
        resetRetry();
        setError({
          code: "GENERIC",
          message: "Could not load prayer times. Please try again later.",
        });
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
    daysOffset: number
  ) => {
    const offset = direction === "next" ? -screenWidth : screenWidth;
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
    ]).start(() => {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + daysOffset);
      router.replace({
        pathname: "/components/[date]",
        params: {
          date: newDate.toISOString(),
          month: newDate.getMonth().toString(),
          year: newDate.getFullYear().toString(),
        },
      });
      fadeAnim.setValue(0);
      slideAnim.setValue(direction === "next" ? screenWidth : -screenWidth);
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

  const ErrorBox = () =>
    !error ? null : (
      <View
        style={{
          backgroundColor: themeColors.primarySurface,
          borderRadius: 12,
          padding: 14,
          marginTop: 8,
          marginBottom: 14,
          borderWidth: 2,
          borderColor: themeColors.accent,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="alert-circle" size={20} color={themeColors.accent} />
          <Text
            style={{
              color: themeColors.accent,
              fontSize: 16,
              marginLeft: 8,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            Problem loading prayer times
          </Text>
        </View>
        <Text
          style={{ color: themeColors.white, marginTop: 8, lineHeight: 20 }}
        >
          {error.message}
        </Text>

        <View
          style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}
        >
          <TouchableOpacity
            onPress={handleRetry}
            style={{
              backgroundColor: themeColors.accent,
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: 8,
              marginRight: 10,
            }}
          >
            <Text
              style={{
                color: themeColors.primary,
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
                borderColor: themeColors.accent,
              }}
            >
              <Text
                style={{
                  color: themeColors.accent,
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
        backgroundColor: themeColors.primarySurface,
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
        marginBottom: 14,
        borderWidth: 2,
        borderColor: themeColors.primarySurface,
      }}
    >
      <Text style={{ color: themeColors.white, textAlign: "center" }}>
        No prayer times available for this date.
      </Text>
      <TouchableOpacity
        onPress={handleRetry}
        style={{
          alignSelf: "center",
          marginTop: 10,
          backgroundColor: themeColors.accent,
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: themeColors.primary, fontWeight: "600" }}>
          Try again
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.primary }}>
      {/* Top Navigation Bar - stays fixed */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 20,
          padding: 20,
          paddingBottom: 0,
        }}
      >
        <TouchableOpacity
          onPress={animateBackToCalendar}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 6,
            paddingHorizontal: 10,
            backgroundColor: themeColors.primarySurface,
            borderRadius: 8,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={themeColors.accent} />
          <Text
            style={{
              color: themeColors.accent,
              fontSize: 16,
              fontFamily: "SFProDisplay-Semibold",
              marginLeft: 4,
            }}
          >
            Calendar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Animated Date Content */}
      <Animated.View
        style={{
          flex: 1,
          padding: 20,
          opacity: fadeAnim,
          transform: [
            {
              scale: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
            { translateX: slideAnim },
          ],
        }}
      >
        {/* Prev / Next Row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          {/* Prev */}
          <TouchableOpacity
            onPress={() => !isPrevDisabled && animateDateChange("prev", -1)}
            disabled={isPrevDisabled}
            style={{
              width: 90,
              alignItems: "center",
              opacity: isPrevDisabled ? 0.4 : 1,
            }}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={themeColors.accent}
            />
            <Text style={{ color: themeColors.accent, fontSize: 14 }}>
              Previous
            </Text>
            {!isPrevDisabled && (
              <Text
                style={{ color: themeColors.white, fontSize: 12, marginTop: 2 }}
              >
                {formatShort(prevDate)}
              </Text>
            )}
          </TouchableOpacity>

          {/* Date Info */}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                color: themeColors.white,
                fontSize: 22,
                textAlign: "center",
              }}
            >
              {selectedDate.toDateString()}
            </Text>
            <Text
              style={{
                color: themeColors.accent,
                fontSize: 15,
                marginTop: 4,
                textAlign: "center",
              }}
            >
              {islamicDate}
            </Text>
          </View>

          {/* Next */}
          <TouchableOpacity
            onPress={() => !isNextDisabled && animateDateChange("next", 1)}
            disabled={isNextDisabled}
            style={{
              width: 90,
              alignItems: "center",
              opacity: isNextDisabled ? 0.4 : 1,
            }}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={themeColors.accent}
            />
            <Text style={{ color: themeColors.accent, fontSize: 14 }}>
              Next
            </Text>
            {!isNextDisabled && (
              <Text
                style={{ color: themeColors.white, fontSize: 12, marginTop: 2 }}
              >
                {formatShort(nextDate)}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Holiday Box */}
        {holiday && (
          <View
            style={{
              backgroundColor: themeColors.primarySurface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              borderWidth: 2,
              borderColor: themeColors.accent,
              shadowColor: themeColors.accent,
              shadowOpacity: 0.6,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text
              style={{
                color: themeColors.accent,
                fontSize: 18,
                textAlign: "center",
              }}
            >
              {holiday}
            </Text>
          </View>
        )}

        {/* Section title */}
        <Text
          style={{
            color: themeColors.white,
            fontSize: 20,
            marginBottom: 10,
            textAlign: "center",
          }}
        >
          Prayer Times
        </Text>

        {/* Error or Empty states */}
        {error && <ErrorBox />}

        <View
          style={{
            marginTop: 10,
            backgroundColor: themeColors.primarySurface,
            borderRadius: 16,
            padding: 20,
            marginBottom: 10,
          }}
        >
          {!loading && !error && prayerTimes.length === 0 ? (
            <EmptyBox />
          ) : (
            <PrayerTimesList
              loading={loading}
              prayerTimes={prayerTimes}
              nextPrayerLabel={isToday ? nextPrayer?.label ?? null : null}
            />
          )}
        </View>

        {isToday && nextPrayer && !error && (
          <View style={{ marginTop: 10, alignItems: "center" }}>
            <Text style={{ color: themeColors.accent, fontSize: 16 }}>
              Next: {nextPrayer.label} in {timeLeft}
            </Text>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}
