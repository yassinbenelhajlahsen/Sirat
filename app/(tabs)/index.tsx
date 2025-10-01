import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { DeviceEventEmitter, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PrayerTimesList from "../components/PrayerTimesList";
import {
  getPrayerTimesToday,
  PrayerSettings,
  PrayerTime,
} from "../services/dailyPrayerTimes";
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
  const [loading, setLoading] = useState(true);

  const DEFAULT_METHOD = 2;
  const DEFAULT_CITY: City = CITIES[0];

  async function getSettings(): Promise<PrayerSettings> {
    const stored = await AsyncStorage.getItem("prayerSettings");
    const base: PrayerSettings = stored
      ? JSON.parse(stored)
      : { useLocation: true, method: DEFAULT_METHOD, city: DEFAULT_CITY };

    if (base.useLocation)
      return { useLocation: true, method: base.method ?? DEFAULT_METHOD };

    if (base.city && typeof base.city.lat === "number") {
      return {
        useLocation: false,
        method: base.method ?? DEFAULT_METHOD,
        city: base.city,
      };
    }

    const savedKey = (base as any).cityKey as string | undefined;
    if (savedKey) {
      const byKey = CITIES.find((c) => cityKey(c) === savedKey);
      if (byKey)
        return {
          useLocation: false,
          method: base.method ?? DEFAULT_METHOD,
          city: byKey,
        };
    }

    return {
      useLocation: false,
      method: base.method ?? DEFAULT_METHOD,
      city: DEFAULT_CITY,
    };
  }

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("settingsChanged", async () => {
      setLoading(true);
      const settings = await getSettings();
      const times = await getPrayerTimesToday(settings);
      setPrayerTimes(times);
      setLoading(false);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const settings = await getSettings();
        const times = await getPrayerTimesToday(settings);
        setPrayerTimes(times);

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
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!nextPrayer) return;
    setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    }, 1000);
    return () => clearInterval(interval);
  }, [nextPrayer]);

  const today = new Date();
  const islamicDate = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#134b0a" }}>
      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            color: "white",
            fontSize: 42,
            fontFamily: "SFProDisplay-Bold",
          }}
        >
          Home
        </Text>

        <View style={{ marginTop: 30, alignItems: "center" }}>
          <Text
            style={{
              color: "white",
              fontSize: 28,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            Today's Prayer Times
          </Text>
          <View style={{ marginTop: 30, alignItems: "center" }}>
            <Text
              style={{
                color: "white",
                fontSize: 22,
                fontFamily: "SFProDisplay-Bold",
                textAlign: "center",
              }}
            >
              {today.toDateString()}
            </Text>
            <Text
              style={{
                color: "#DABA69",
                fontSize: 16,
                fontFamily: "SFProDisplay-Semibold",
                marginTop: 4,
                marginBottom: 20,
                textAlign: "center",
              }}
            >
              {islamicDate}
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 20,
            backgroundColor: "#1a5f0e",
            borderRadius: 16,
            padding: 20,
          }}
        >
          <PrayerTimesList
            loading={loading}
            prayerTimes={prayerTimes}
            nextPrayerLabel={nextPrayer?.label ?? null}
          />
        </View>

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
