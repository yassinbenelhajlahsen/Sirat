import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView, Text, View } from "react-native";

const prayerTimes = [
  { label: "Fajr", time: "3:45 AM" },
  { label: "Sunrise", time: "5:24 AM" },
  { label: "Dhuhr", time: "12:57 PM" },
  { label: "Asr", time: "4:57 PM" },
  { label: "Maghrib", time: "8:29 PM" },
  { label: "Isha", time: "10:09 PM" },
];

const nearbyMosques = [
  { name: "Ar-Rahman", address: "333 86th St, Brooklyn, NY 11209" },
  {
    name: "Islamic Society of Bay Ridge",
    address: "6807 5th Ave, Brooklyn, NY 11220",
  },
  {
    name: "Maryam Mosque",
    address: "7307 5th Ave, Brooklyn, NY 11209",
  },
];

function parseTimeToDate(timeStr: string): Date {
  const now = new Date();
  const [time, modifier] = timeStr.split(" ");
  const [hoursStr, minutesStr] = time.split(":");
  let hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function getTimeUntil(nextTime: Date): string {
  const now = new Date();
  const diffMs = nextTime.getTime() - now.getTime();

  if (diffMs <= 0) return "Now";

  const seconds = Math.floor((diffMs / 1000) % 60);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function Home() {
  const [nextPrayer, setNextPrayer] = useState<null | {
    label: string;
    time: string;
    dateObj: Date;
  }>(null);

  useEffect(() => {
    const now = new Date();
    for (let pt of prayerTimes) {
      const timeObj = parseTimeToDate(pt.time);
      if (timeObj > now) {
        setNextPrayer({ ...pt, dateObj: timeObj });
        break;
      }
    }
  }, []);

  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!nextPrayer) return;

    const interval = setInterval(() => {
      setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    }, 1000);

    return () => clearInterval(interval);
  }, [nextPrayer]);

  let today = new Date();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0c3605" }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: 20,
          paddingHorizontal: 20,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            color: "white",
            fontFamily: "SFProDisplay-Bold",
            fontSize: 42,
            marginBottom: 10,
          }}
        >
          Home
        </Text>

        <View style={{ marginTop: 30, alignItems: "center" }}>
          <Text
            style={{
              color: "white",
              fontSize: 24,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            Today's Prayer Times
          </Text>
          <Text
            style={{
              color: "white",
              fontSize: 18,
              fontFamily: "SFProDisplay-Regular",
              marginTop: 5,
              opacity: 0.9,
            }}
          >
            {today.toDateString()}
          </Text>
          <Text
            style={{
              color: "white",
              fontSize: 18,
              fontFamily: "SFProDisplay-Regular",
              marginTop: 2,
              opacity: 0.8,
            }}
          >
            Dhuʻl-Hijjah 19, 1446 AH
          </Text>
        </View>

        {/* Prayer Time Card */}
        <View
          style={{
            marginTop: 30,
            backgroundColor: "#134b0a",
            borderRadius: 16,
            padding: 20,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 4,
          }}
        >
          {prayerTimes.map(({ label, time }, index) => {
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

        {/* Time Until Next Prayer */}
        {nextPrayer && (
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

        {/* Nearby Mosques */}
        <View style={{ marginTop: 50 }}>
          <Text
            style={{
              color: "white",
              fontSize: 24,
              fontFamily: "SFProDisplay-Semibold",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            Nearby Mosques
          </Text>

          {nearbyMosques.map(({ name, address }) => (
            <View
              key={name}
              style={{
                backgroundColor: "#134b0a",
                borderRadius: 14,
                padding: 16,
                marginBottom: 15,
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontFamily: "SFProDisplay-Semibold",
                  fontSize: 20,
                }}
              >
                {name}
              </Text>
              <Text
                style={{
                  color: "white",
                  fontFamily: "SFProDisplay-Regular",
                  fontSize: 16,
                  marginTop: 4,
                  opacity: 0.85,
                }}
              >
                {address}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
