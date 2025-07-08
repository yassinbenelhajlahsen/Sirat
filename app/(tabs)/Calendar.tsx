import { Ionicons } from "@expo/vector-icons";
import { useRouter,useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";

const ISLAMIC_HOLIDAYS: Record<string, string> = {
  "2025-06-06": "Eid al-Adha",
  "2025-03-31": "Start of Ramadan",
  "2025-04-09": "Laylat al-Qadr",
  "2025-05-01": "Eid al-Fitr",
};

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

const initialMonth = typeof month === "string" ? parseInt(month) : today.getMonth();
const initialYear = typeof year === "string" ? parseInt(year) : today.getFullYear();

const minDate = new Date(today.getFullYear() - 1, 0);
const maxDate = new Date(today.getFullYear() + 1, 11);

const [viewYear, setViewYear] = useState(initialYear);
const [viewMonth, setViewMonth] = useState(initialMonth);
  const isViewingToday =
    viewMonth === today.getMonth() && viewYear === today.getFullYear();
  const matrix = getMonthMatrix(viewYear, viewMonth);
  const monthName = new Date(viewYear, viewMonth).toLocaleString("default", {
    month: "long",
  });

  const goToPreviousMonth = () => {
    const prev = new Date(viewYear, viewMonth - 1);
    if (prev >= minDate) {
      setViewYear(prev.getFullYear());
      setViewMonth(prev.getMonth());
    }
  };

  const goToNextMonth = () => {
    const next = new Date(viewYear, viewMonth + 1);
    if (next <= maxDate) {
      setViewYear(next.getFullYear());
      setViewMonth(next.getMonth());
    }
  };

  return (
    
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0c3605" }}>
      <View style={{ flex: 1, padding: 16, justifyContent: "flex-start" }}>
        {/* Header */}
           <Text style= {{color: "white", fontFamily: "SFProDisplay-Bold", fontSize: 45, marginBottom: 20}}>Calendar</Text>

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

        {/* Grid Wrapper */}
        <View style={{ flex: 1, justifyContent: "flex-start" }}>
          {/* Day of Week Headers */}
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

          {/* Day Grid */}
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

                  let isHoliday = false;
                  let dateKey = "";

                  if (day > 0) {
                    const dateObj = new Date(viewYear, viewMonth, day);
                    dateKey = dateObj.toISOString().split("T")[0];
                    isHoliday = ISLAMIC_HOLIDAYS[dateKey] !== undefined;
                  }

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
                          router.push({
                            pathname: "/calendar/[date]",
                            params: {
                              date: selectedDate.toISOString(),
                              month: viewMonth.toString(),
                              year: viewYear.toString(),
                            },
                          });
                        }
                      }}
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
        </View>

        {/* Back to Today Button */}
        {!isViewingToday && (
          <TouchableOpacity
            onPress={() => {
              setViewYear(today.getFullYear());
              setViewMonth(today.getMonth());
            }}
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
      </View>
    </SafeAreaView>
  );
}
