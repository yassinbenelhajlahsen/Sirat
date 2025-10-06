import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrayerTimesList from "../components/PrayerTimesList";
import {
  dateKeyFromDate,
  getHolidayMapForYear,
} from "../../services/holidayService";
import {
  getPrayerTimesForDate,
  PrayerSettings,
  PrayerTime,
} from "../../services/yearlyPrayerTimes";
import getTimeUntil from "../../util/getTimeUntil";

const screenWidth = Dimensions.get("window").width;

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

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typeof date === "string") {
      setSelectedDate(new Date(decodeURIComponent(date)));
    }
    if (typeof holidayParam === "string" && holidayParam.trim() !== "") {
      setHoliday(holidayParam);
    }
  }, [date, holidayParam]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedDate || (holidayParam && holidayParam.trim() !== "")) return;
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
  }, [selectedDate, holidayParam]);

  const today = new Date();
  const isToday = selectedDate?.toDateString() === today.toDateString();

  useEffect(() => {
    if (!selectedDate) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const settings: PrayerSettings = { useLocation: true, method: 2 };
        const times = await getPrayerTimesForDate(settings, selectedDate);
        if (mounted) setPrayerTimes(times);
      } catch (err) {
        console.error("Error fetching prayer times:", err);
        if (mounted) setPrayerTimes([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

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

  // Smooth fade when going "Back to Calendar"
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#134b0a" }}>
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
            backgroundColor: "#1a5f0e",
            borderRadius: 8,
          }}
        >
          <Ionicons name="chevron-back" size={20} color="#DABA69" />
          <Text
            style={{
              color: "#DABA69",
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
            <Ionicons name="chevron-back" size={20} color="#DABA69" />
            <Text style={{ color: "#DABA69", fontSize: 14 }}>Previous</Text>
            {!isPrevDisabled && (
              <Text style={{ color: "white", fontSize: 12, marginTop: 2 }}>
                {formatShort(prevDate)}
              </Text>
            )}
          </TouchableOpacity>

          {/* Date Info */}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: "white", fontSize: 22, textAlign: "center" }}>
              {selectedDate.toDateString()}
            </Text>
            <Text
              style={{
                color: "#DABA69",
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
            <Ionicons name="chevron-forward" size={20} color="#DABA69" />
            <Text style={{ color: "#DABA69", fontSize: 14 }}>Next</Text>
            {!isNextDisabled && (
              <Text style={{ color: "white", fontSize: 12, marginTop: 2 }}>
                {formatShort(nextDate)}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Holiday Box */}
        {holiday && (
          <View
            style={{
              backgroundColor: "#1a5f0e",
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              borderWidth: 2,
              borderColor: "#DABA69",
              shadowColor: "#DABA69",
              shadowOpacity: 0.6,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Text
              style={{
                color: "#DABA69",
                fontSize: 18,
                textAlign: "center",
              }}
            >
              {holiday}
            </Text>
          </View>
        )}

        {/* Prayer Times */}
        <Text
          style={{
            color: "white",
            fontSize: 20,
            marginBottom: 10,
            textAlign: "center",
          }}
        >
          Prayer Times
        </Text>

        <View
          style={{
            marginTop: 10,
            backgroundColor: "#1a5f0e",
            borderRadius: 16,
            padding: 20,
            marginBottom: 10,
          }}
        >
          <PrayerTimesList
            loading={loading}
            prayerTimes={prayerTimes}
            nextPrayerLabel={isToday ? nextPrayer?.label ?? null : null}
          />
        </View>

        {isToday && nextPrayer && (
          <View style={{ marginTop: 10, alignItems: "center" }}>
            <Text style={{ color: "#DABA69", fontSize: 16 }}>
              Next: {nextPrayer.label} in {timeLeft}
            </Text>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}
