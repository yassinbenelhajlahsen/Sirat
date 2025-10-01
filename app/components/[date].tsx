import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import PrayerTimesList from "../components/PrayerTimesList";
import {
  dateKeyFromDate,
  getHolidayMapForYear,
} from "../services/holidayService";
import {
  getPrayerTimesForDate,
  PrayerSettings,
  PrayerTime,
} from "../services/yearlyPrayerTimes";
import getTimeUntil from "../util/getTimeUntil";

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

  // Parse incoming date and holiday
  useEffect(() => {
    if (typeof date === "string") {
      const decoded = new Date(decodeURIComponent(date));
      setSelectedDate(decoded);
    } else {
      setSelectedDate(null);
    }

    if (typeof holidayParam === "string" && holidayParam.trim() !== "") {
      setHoliday(holidayParam);
    } else {
      setHoliday(null);
    }
  }, [date, holidayParam]);

  // Fallback: compute holiday for date if not passed
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!selectedDate) return;
      if (holidayParam && holidayParam.trim() !== "") return;

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

  // Fetch prayer times
  useEffect(() => {
    if (!selectedDate) return;
    let mounted = true;

    async function loadTimes() {
      setLoading(true);
      try {
        const settings: PrayerSettings = { useLocation: true, method: 2 };
        try {
          const times = await getPrayerTimesForDate(settings, selectedDate);
          if (mounted) setPrayerTimes(times);
        } catch (err: any) {
          console.error("Prayer API error:", err.message);
          Alert.alert("Something went wrong. Try again later.");
        }
      } catch (err) {
        console.error("Error fetching prayer times:", err);
        if (mounted) setPrayerTimes([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadTimes();
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  // Next prayer countdown (only for today)
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

  // Navigation
  const minDate = new Date(today.getFullYear() - 1, 0);
  const maxDate = new Date(today.getFullYear() + 1, 11, 31);
  const prevDate = new Date(selectedDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(selectedDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const isPrevDisabled = prevDate < minDate;
  const isNextDisabled = nextDate > maxDate;

  const changeDate = (daysOffset: number) => {
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
  };

  const formatShort = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#134b0a" }}>
      <View style={{ padding: 20 }}>
        {/* Top Navigation Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <TouchableOpacity
            onPress={() =>
              router.replace(`/Calendar?month=${month}&year=${year}`)
            }
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

        {/* Prev / Date / Next row */}
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
            onPress={() => !isPrevDisabled && changeDate(-1)}
            disabled={isPrevDisabled}
            style={{
              width: 90,
              alignItems: "center",
              opacity: isPrevDisabled ? 0.4 : 1,
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#DABA69" />
            <Text
              style={{
                color: "#DABA69",
                fontSize: 14,
                fontFamily: "SFProDisplay-Semibold",
              }}
            >
              Previous
            </Text>
            {!isPrevDisabled && (
              <Text
                style={{
                  color: "white",
                  fontSize: 12,
                  marginTop: 2,
                  fontFamily: "SFProDisplay-Regular",
                }}
              >
                {formatShort(prevDate)}
              </Text>
            )}
          </TouchableOpacity>

          {/* Date Info */}
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text
              style={{
                color: "white",
                fontSize: 22,
                fontFamily: "SFProDisplay-Bold",
                textAlign: "center",
              }}
            >
              {selectedDate.toDateString()}
            </Text>
            <Text
              style={{
                color: "#DABA69",
                fontSize: 15,
                fontFamily: "SFProDisplay-Semibold",
                marginTop: 4,
                textAlign: "center",
              }}
            >
              {islamicDate}
            </Text>
          </View>

          {/* Next */}
          <TouchableOpacity
            onPress={() => !isNextDisabled && changeDate(1)}
            disabled={isNextDisabled}
            style={{
              width: 90,
              alignItems: "center",
              opacity: isNextDisabled ? 0.4 : 1,
            }}
          >
            <Ionicons name="chevron-forward" size={20} color="#DABA69" />
            <Text
              style={{
                color: "#DABA69",
                fontSize: 14,
                fontFamily: "SFProDisplay-Semibold",
              }}
            >
              Next
            </Text>
            {!isNextDisabled && (
              <Text
                style={{
                  color: "white",
                  fontSize: 12,
                  marginTop: 2,
                  fontFamily: "SFProDisplay-Regular",
                }}
              >
                {formatShort(nextDate)}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Holiday */}
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
                fontFamily: "SFProDisplay-Bold",
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
            fontFamily: "SFProDisplay-Semibold",
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
            <Text
              style={{
                color: "#DABA69",
                fontSize: 16,
                fontFamily: "SFProDisplay-Semibold",
              }}
            >
              Next: {nextPrayer.label} in {timeLeft}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
