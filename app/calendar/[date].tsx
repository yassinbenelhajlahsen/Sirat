import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";

const MOCK_PRAYER_TIMES = {
  Fajr: "3:45 AM",
  Sunrise: "5:24 AM",
  Dhuhr: "12:57 PM",
  Asr: "4:57 PM",
  Maghrib: "8:29 PM",
  Isha: "10:09 PM",
};

const ISLAMIC_HOLIDAYS: Record<string, string> = {
  "2025-06-06": "Eid al-Adha",
  "2025-03-31": "Start of Ramadan",
  "2025-04-09": "Laylat al-Qadr",
  "2025-05-01": "Eid al-Fitr",
};

function formatHijriMock(date: Date): string {
  return "Dhuʻl-Hijjah 19, 1446 AH";
}

export default function CalendarDetail() {
  const { date, month, year } = useLocalSearchParams();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [holiday, setHoliday] = useState<string | null>(null);

  useEffect(() => {
    if (typeof date === "string") {
      const decoded = new Date(decodeURIComponent(date));
      setSelectedDate(decoded);

      const iso = decoded.toISOString().split("T")[0];
      setHoliday(ISLAMIC_HOLIDAYS[iso] || null);
    }
  }, [date]);

  if (!selectedDate) return null;
  const today = new Date();
  const minDate = new Date(today.getFullYear() - 1, 0); // Jan of last year
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0c3605" }}>
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
          <Text
            style={{
              color: "#DABA69",
              fontSize: 16,
              fontFamily: "SFProDisplay-Semibold",
              marginLeft: 6,
            }}
          >
            Back to Calendar
          </Text>
        </TouchableOpacity>

        {/* Prev / Next Day Buttons */}
        <View
  style={{
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 20
  }}
>
  <TouchableOpacity
    onPress={() => !isPrevDisabled && changeDate(-1)}
    disabled={isPrevDisabled}
    style={{
      backgroundColor: "#1f4e17",
      padding: 12,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
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
      backgroundColor: "#1f4e17",
      padding: 12,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      opacity: isNextDisabled ? 0.4 : 1,
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
          }}
        >
          {formatHijriMock(selectedDate)}
        </Text>

        {/* Holiday Info */}
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
        <View
          style={{
            backgroundColor: "#134b0a",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 20,
              fontFamily: "SFProDisplay-Semibold",
              marginBottom: 10,
            }}
          >
            Prayer Times
          </Text>

          {Object.entries(MOCK_PRAYER_TIMES).map(([label, time]) => (
            <View
              key={label}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 6,
                borderBottomColor: "#1f4e17",
                borderBottomWidth: 1,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontFamily: "SFProDisplay-Regular",
                  fontSize: 18,
                }}
              >
                {label}
              </Text>
              <Text
                style={{
                  color: "white",
                  fontFamily: "SFProDisplay-Regular",
                  fontSize: 18,
                }}
              >
                {time}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
