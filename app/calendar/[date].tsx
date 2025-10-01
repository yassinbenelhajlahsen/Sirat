import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getPrayerTimesForDate,
  PrayerSettings,
  PrayerTime,
} from "../services/yearlyPrayerTimes";
import getTimeUntil from "../util/getTimeUntil";

const ISLAMIC_HOLIDAYS: Record<string, string> = {
  "2025-06-06": "Eid al-Adha",
  "2025-03-31": "Start of Ramadan",
  "2025-04-09": "Laylat al-Qadr",
  "2025-05-01": "Eid al-Fitr",
};

export default function CalendarDetail() {
  const { date, month, year } = useLocalSearchParams();
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

  // Parse date param and detect holiday
  useEffect(() => {
    if (typeof date === "string") {
      const decoded = new Date(decodeURIComponent(date));
      setSelectedDate(decoded);

      const iso = decoded.toISOString().split("T")[0];
      setHoliday(ISLAMIC_HOLIDAYS[iso] || null);
    }
  }, [date]);

  const today = new Date();
  const isToday = selectedDate?.toDateString() === today.toDateString();

  // Fetch prayer times for selected date
  useEffect(() => {
    if (!selectedDate) return;

    async function loadTimes() {
      setLoading(true);
      try {
        const settings: PrayerSettings = {
          useLocation: true, // or false if you want manual city selection
          method: 2, // Karachi method, or -1 for auto
        };
        const times = await getPrayerTimesForDate(settings, selectedDate);
        setPrayerTimes(times);
      } catch (err) {
        console.error("Error fetching prayer times:", err);
        setPrayerTimes([]);
      } finally {
        setLoading(false);
      }
    }

    loadTimes();
  }, [selectedDate]);

  // Figure out next prayer (for today only)
  useEffect(() => {
    if (!isToday || prayerTimes.length === 0) return;

    const now = new Date();
    for (let { label, time } of prayerTimes) {
      const [hoursMinutes, ampm] = time.split(" ");
      const [h, m] = hoursMinutes.split(":");
      let hours = parseInt(h);
      const minutes = parseInt(m);

      if (ampm.toLowerCase() === "pm" && hours !== 12) hours += 12;
      if (ampm.toLowerCase() === "am" && hours === 12) hours = 0;

      const dateObj = new Date(today);
      dateObj.setHours(hours, minutes, 0, 0);

      if (dateObj > now) {
        setNextPrayer({ label, time, dateObj });
        break;
      }
    }
  }, [isToday, prayerTimes]);

  // Countdown timer
  useEffect(() => {
    if (!nextPrayer) return;
    setTimeLeft(getTimeUntil(nextPrayer.dateObj));

    const interval = setInterval(() => {
      setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    }, 1000);

    return () => clearInterval(interval);
  }, [nextPrayer]);

  if (!selectedDate) return null;

  let islamicDate = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(selectedDate);

  // Navigation between days
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
      pathname: "/calendar/[date]",
      params: {
        date: newDate.toISOString(),
        month: newDate.getMonth().toString(),
        year: newDate.getFullYear().toString(),
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#134b0a" }}>
      <View style={{ padding: 20 }}>
        {/* Back to Calendar */}
        <TouchableOpacity
          onPress={() =>
            router.replace(`/Calendar?month=${month}&year=${year}`)
          }
          style={{
            marginBottom: 16,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ionicons name="chevron-back" size={24} color="#DABA69" />
        </TouchableOpacity>

        {/* Prev / Next Day */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 16,
            marginBottom: 20,
          }}
        >
          <TouchableOpacity
            onPress={() => !isPrevDisabled && changeDate(-1)}
            disabled={isPrevDisabled}
            style={{
              backgroundColor: "#1a5f0e",
              padding: 12,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
              shadowOpacity: 0.1,
              opacity: isPrevDisabled ? 0.4 : 1,
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#DABA69" />
            <Text
              style={{
                color: "#DABA69",
                fontFamily: "SFProDisplay-Semibold",
                fontSize: 16,
                marginLeft: 4,
              }}
            >
              Previous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => !isNextDisabled && changeDate(1)}
            disabled={isNextDisabled}
            style={{
              backgroundColor: "#1a5f0e",
              padding: 12,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
              opacity: isNextDisabled ? 0.4 : 1,
              shadowOpacity: 0.1,
            }}
          >
            <Text
              style={{
                color: "#DABA69",
                fontFamily: "SFProDisplay-Semibold",
                fontSize: 16,
                marginRight: 4,
              }}
            >
              Next
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#DABA69" />
          </TouchableOpacity>
        </View>

        {/* Date Info */}
        <Text
          style={{
            color: "white",
            fontSize: 26,
            fontFamily: "SFProDisplay-Bold",
            textAlign: "center",
          }}
        >
          {selectedDate.toDateString()}
        </Text>
        <Text
          style={{
            color: "#DABA69",
            fontSize: 18,
            fontFamily: "SFProDisplay-Semibold",
            marginTop: 4,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          {islamicDate}
        </Text>

        {/* Holiday */}
        {holiday && (
          <View
            style={{
              backgroundColor: "#134b0a",
              borderRadius: 12,
              padding: 16,
              marginBottom: 30,
            }}
          >
            <Text
              style={{
                color: "#DABA69",
                fontSize: 18,
                fontFamily: "SFProDisplay-Semibold",
              }}
            >
              Islamic Holiday
            </Text>
            <Text
              style={{
                color: "white",
                fontSize: 16,
                fontFamily: "SFProDisplay-Regular",
                marginTop: 4,
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

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#DABA69"
            style={{ marginTop: 20 }}
          />
        ) : (
          <View
            style={{
              marginTop: 10,
              backgroundColor: "#1a5f0e",
              borderRadius: 16,
              padding: 20,
              shadowColor: "#000",
              shadowRadius: 6,
              shadowOpacity: 0.15,
              elevation: 4,
              marginBottom: 10,
            }}
          >
            {prayerTimes.map(({ label, time }) => {
              const isNext = nextPrayer?.label === label;
              return (
                <View
                  key={label}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: isNext ? "#1b5e11" : "transparent",
                    borderColor: isNext ? "#DABA69" : "transparent",
                    borderWidth: isNext ? 2 : 0,
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      color: "white",
                      fontFamily: isNext
                        ? "SFProDisplay-Semibold"
                        : "SFProDisplay-Regular",
                      fontSize: 20,
                    }}
                  >
                    {label}
                  </Text>
                  <Text
                    style={{
                      color: "white",
                      fontFamily: isNext
                        ? "SFProDisplay-Semibold"
                        : "SFProDisplay-Regular",
                      fontSize: 20,
                    }}
                  >
                    {time}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {nextPrayer && isToday && (
          <View style={{ marginTop: 10, alignItems: "center" }}>
            <Text
              style={{
                color: "#DABA69",
                fontSize: 17,
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
