import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  dateKeyFromDate,
  getHolidayMapForYear,
} from "../../services/holidayService";

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

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const isViewingToday =
    viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const matrix = useMemo(
    () => getMonthMatrix(viewYear, viewMonth),
    [viewYear, viewMonth]
  );
  const monthName = useMemo(
    () =>
      new Date(viewYear, viewMonth).toLocaleString("default", {
        month: "long",
      }),
    [viewYear, viewMonth]
  );

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

  // Month fade animation
  const animateMonthChange = (newYear: number, newMonth: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setViewYear(newYear);
      setViewMonth(newMonth);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const goToPreviousMonth = () => {
    const prev = new Date(viewYear, viewMonth - 1);
    if (prev >= minDate) {
      animateMonthChange(prev.getFullYear(), prev.getMonth());
    }
  };

  const goToNextMonth = () => {
    const next = new Date(viewYear, viewMonth + 1);
    if (next <= maxDate) {
      animateMonthChange(next.getFullYear(), next.getMonth());
    }
  };

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
            },
          });
          // do NOT reset fadeAnim immediately; let new screen take over
          setNavigating(false);
        }, 50);
      }
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#134b0a" }}>
      <Animated.View
        style={{
          flex: 1,
          padding: 16,
          opacity: fadeAnim,
          transform: [
            {
              scale: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            },
          ],
        }}
      >
        {/* Header */}
        <Text
          style={{
            color: "white",
            fontFamily: "SFProDisplay-Bold",
            fontSize: 45,
            marginBottom: 20,
          }}
        >
          Calendar
        </Text>

        {/* Month Navigation */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <TouchableOpacity
            onPress={goToPreviousMonth}
            disabled={new Date(viewYear, viewMonth - 1) < minDate}
          >
            <Ionicons
              name="chevron-back"
              size={28}
              color={
                new Date(viewYear, viewMonth - 1) < minDate ? "#555" : "#DABA69"
              }
            />
          </TouchableOpacity>

          <Text
            style={{
              color: "white",
              fontSize: 22,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            {monthName} {viewYear}
          </Text>

          <TouchableOpacity
            onPress={goToNextMonth}
            disabled={new Date(viewYear, viewMonth + 1) > maxDate}
          >
            <Ionicons
              name="chevron-forward"
              size={28}
              color={
                new Date(viewYear, viewMonth + 1) > maxDate ? "#555" : "#DABA69"
              }
            />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View style={{ flex: 1, justifyContent: "flex-start" }}>
          {/* Day of week */}
          <View
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <Text
                key={`${d}-${i}`}
                style={{
                  color: "#DABA69",
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

          {loadingHolidays ? (
            <View style={{ marginTop: 30, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#DABA69" />
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
                      <TouchableOpacity
                        key={j}
                        onPress={() => {
                          if (day > 0) {
                            const selectedDate = new Date(
                              viewYear,
                              viewMonth,
                              day
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
                            ? "#DABA69"
                            : isHoliday
                            ? "#1b4e10"
                            : "transparent",
                          borderColor: isHoliday ? "#DABA69" : "transparent",
                          borderWidth: isHoliday ? 2 : 0,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: isToday
                              ? "#0c3605"
                              : isHoliday
                              ? "#DABA69"
                              : "white",
                            fontFamily: "SFProDisplay-Regular",
                            fontSize: 16,
                          }}
                        >
                          {day > 0 ? day : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Back to Today */}
        {!isViewingToday && (
          <TouchableOpacity
            onPress={() =>
              animateMonthChange(today.getFullYear(), today.getMonth())
            }
            style={{
              marginTop: 24,
              alignSelf: "center",
              backgroundColor: "#DABA69",
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
            }}
          >
            <Text
              style={{
                color: "#0c3605",
                fontSize: 16,
                fontFamily: "SFProDisplay-Semibold",
              }}
            >
              Back to Today
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}
