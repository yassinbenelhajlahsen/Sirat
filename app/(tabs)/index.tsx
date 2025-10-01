import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { DeviceEventEmitter, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getPrayerTimes,
  PrayerSettings,
  PrayerTime,
} from "../services/prayerTimesService";
import CITIES, { City, cityKey } from "../util/cities";
import getTimeUntil from "../util/getTimeUntil";

// Helper: parse "3:45 PM" into Date
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

export default function Home() {
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<null | {
    label: string;
    time: string;
    dateObj: Date;
  }>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const DEFAULT_METHOD = 2;
  const DEFAULT_CITY: City = CITIES[0];

  // Helper to get settings, using selected city if location is off
  async function getSettings(): Promise<PrayerSettings> {
    const stored = await AsyncStorage.getItem("prayerSettings");
    const base: PrayerSettings = stored
      ? JSON.parse(stored)
      : { useLocation: true, method: DEFAULT_METHOD, city: DEFAULT_CITY };

    // If using GPS, no manual city is required
    if (base.useLocation) {
      return { useLocation: true, method: base.method ?? DEFAULT_METHOD };
    }

    // If not using GPS, resolve a City object robustly
    // 1) Already have a full city object saved
    if (
      base.city &&
      typeof base.city.lat === "number" &&
      typeof base.city.lng === "number"
    ) {
      return {
        useLocation: false,
        method: base.method ?? DEFAULT_METHOD,
        city: base.city,
      };
    }

    // 2) Try a saved cityKey inside prayerSettings
    const savedKey = (base as any).cityKey as string | undefined;
    if (savedKey) {
      const byKey = CITIES.find((c) => cityKey(c) === savedKey);
      if (byKey) {
        return {
          useLocation: false,
          method: base.method ?? DEFAULT_METHOD,
          city: byKey,
        };
      }
    }

    // 3) Legacy support: read "selectedCity" which might be a key or a plain name
    const legacy = await AsyncStorage.getItem("selectedCity");
    if (legacy) {
      const byExactKey = CITIES.find((c) => cityKey(c) === legacy);
      if (byExactKey) {
        return {
          useLocation: false,
          method: base.method ?? DEFAULT_METHOD,
          city: byExactKey,
        };
      }
      const byName = CITIES.find((c) => c.name === legacy);
      if (byName) {
        return {
          useLocation: false,
          method: base.method ?? DEFAULT_METHOD,
          city: byName,
        };
      }
    }

    // 4) Final fallback to a known city to avoid crashes
    return {
      useLocation: false,
      method: base.method ?? DEFAULT_METHOD,
      city: DEFAULT_CITY,
    };
  }
  // Update page when any settings are changed
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("settingsChanged", async () => {
      const settings = await getSettings();
      const times = await getPrayerTimes(settings);
      setPrayerTimes(times);
    });
    return () => sub.remove();
  }, []);

  // Load prayer times
  useEffect(() => {
    (async () => {
      try {
        const settings = await getSettings();
        const times = await getPrayerTimes(settings);
        setPrayerTimes(times);

        // Find next prayer
        const now = new Date();
        for (let pt of times) {
          const timeObj = parseTimeToDate(pt.time);
          if (timeObj > now) {
            setNextPrayer({ ...pt, dateObj: timeObj });
            break;
          }
        }
      } catch (err) {
        console.error("Error fetching prayer times:", err);
      }
    })();
  }, []);

  // Update countdown
  useEffect(() => {
    if (!nextPrayer) return;

    setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    }, 1000);

    return () => clearInterval(interval);
  }, [nextPrayer]);

  let today = new Date();
  let islamicDate = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

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
        {/* Header */}
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

        {/* Date */}
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
              fontSize: 20,
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
              fontSize: 20,
              fontFamily: "SFProDisplay-Regular",
              marginTop: 2,
              opacity: 0.9,
            }}
          >
            {islamicDate}
          </Text>
        </View>

        {/* Prayer Times */}
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

        {/* Countdown */}
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
      </ScrollView>
    </SafeAreaView>
  );
}
