// app/(tabs)/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  DeviceEventEmitter,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getPrayerTimesToday,
  PrayerSettings,
  PrayerTime,
} from "../../services/dailyPrayerTimes";
import CITIES, { City, cityKey } from "../../util/cities";
import getTimeUntil from "../../util/getTimeUntil";
import PrayerTimesList from "../components/PrayerTimesList";

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
  const router = useRouter();
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [nextPrayer, setNextPrayer] = useState<null | {
    label: string;
    time: string;
    dateObj: Date;
  }>(null);
  const [nextDayFajr, setNextDayFajr] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<string>("");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const DEFAULT_METHOD = 2;
  const DEFAULT_CITY: City = CITIES[0];

  async function getSettings(): Promise<PrayerSettings> {
    const stored = await AsyncStorage.getItem("prayerSettings");
    const base: PrayerSettings = stored
      ? JSON.parse(stored)
      : { useLocation: true, method: DEFAULT_METHOD, city: DEFAULT_CITY };

    if (!base.useLocation) {
      if (base.city && typeof base.city.lat === "number") return base;
      const savedKey = (base as any).cityKey as string | undefined;
      if (savedKey) {
        const byKey = CITIES.find((c) => cityKey(c) === savedKey);
        if (byKey) return { ...base, city: byKey };
      }
      return { ...base, city: DEFAULT_CITY };
    }

    return {
      useLocation: true,
      method: base.method ?? DEFAULT_METHOD,
      city: base.city ?? DEFAULT_CITY,
    };
  }

  async function persistSettings(payload: PrayerSettings) {
    const save = {
      useLocation: payload.useLocation,
      method: payload.method,
      cityKey: payload.city ? cityKey(payload.city) : undefined,
      city: payload.city,
    };
    await AsyncStorage.setItem("prayerSettings", JSON.stringify(save));
    if (!payload.useLocation && payload.city) {
      await AsyncStorage.setItem("selectedCity", cityKey(payload.city));
    }
    DeviceEventEmitter.emit("settingsChanged", save);
  }

  // Non-destructive OS reconciliation.
  // If OS blocks location, we *temporarily* fall back to manual without persisting useLocation=false.
  async function reconcileWithOS(
    settings: PrayerSettings,
    forceUseLocation: boolean | null
  ): Promise<PrayerSettings> {
    if (forceUseLocation === true) {
      setBanner("");
      return { ...settings, useLocation: true };
    }
    if (forceUseLocation === false) {
      const manualCity = settings.city ?? DEFAULT_CITY;
      setBanner(
        `Location is unavailable, using your manual city: ${manualCity.name}.`
      );
      return {
        useLocation: false,
        method: settings.method ?? DEFAULT_METHOD,
        city: manualCity,
      };
    }
    // No force — keep current settings as is
    return settings;
  }

  const loadData = async (opts?: { forceUseLocation?: boolean }) => {
    try {
      setLoading(true);

      setPrayerTimes([]);
      setNextPrayer(null);
      setNextDayFajr(null);
      setTimeLeft("");
      fadeAnim.setValue(0);

      let settings = await getSettings();
      settings = await reconcileWithOS(
        settings,
        typeof opts?.forceUseLocation === "boolean"
          ? opts.forceUseLocation
          : null
      );

      const times = await getPrayerTimesToday(settings);
      setPrayerTimes(times);

      const now = new Date();
      let foundNext = false;
      for (let pt of times) {
        const timeObj = parseTimeToDate(pt.time);
        if (timeObj > now) {
          setNextPrayer({ ...pt, dateObj: timeObj });
          foundNext = true;
          break;
        }
      }

      if (!foundNext) {
        // Peek tomorrow with the same effective settings
        const tomorrowTimes = await getPrayerTimesToday(settings);
        const fajr = tomorrowTimes.find((p) => p.label === "Fajr");
        if (fajr) setNextDayFajr(fajr.time);
      }
    } catch (err) {
      console.error("Error fetching prayer times:", err);
      setBanner(
        "We could not load prayer times right now. Please try again later or set a manual city in Settings."
      );
    } finally {
      setLoading(false);
    }
  };

  const bootstrapAndLoad = async () => {
    try {
      // Notifications can be requested in parallel; do not block UI on it.
      try {
        await Notifications.requestPermissionsAsync();
      } catch {}

      // Location: wait for a final status to avoid persisting a false manual fallback.
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === "undetermined") {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      const canUseLocation = servicesEnabled && perm.status === "granted";

      await loadData({ forceUseLocation: canUseLocation });
    } catch (e) {
      console.warn("bootstrap failed:", e);
      await loadData({ forceUseLocation: false });
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // On pull-to-refresh, re-check OS quickly
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    const perm = await Location.getForegroundPermissionsAsync();
    await loadData({
      forceUseLocation: servicesEnabled && perm.status === "granted",
    });
    setRefreshing(false);
  };

  // Foreground re-sync in case user toggled OS settings outside the app
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (s) => {
      if (s === "active") {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        const perm = await Location.getForegroundPermissionsAsync();
        await loadData({
          forceUseLocation: servicesEnabled && perm.status === "granted",
        });
      }
    });
    return () => sub.remove();
  }, []);

  // Listen for in-app Settings changes
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("settingsChanged", async () => {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      const perm = await Location.getForegroundPermissionsAsync();
      await loadData({
        forceUseLocation: servicesEnabled && perm.status === "granted",
      });
    });
    return () => sub.remove();
  }, []);

  // Initial launch
  useEffect(() => {
    bootstrapAndLoad();
  }, []);

  useEffect(() => {
    if (!nextPrayer) return;
    setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    }, 1000);
    return () => clearInterval(interval);
  }, [nextPrayer]);

  useEffect(() => {
    if (nextDayFajr || nextPrayer) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [nextDayFajr, nextPrayer]);

  const colors = {
    bg: "#134b0a",
    card: "#1a5f0e",
    text: "#ffffff",
    accent: "#DABA69",
  };

  const today = new Date();
  const islamicDate = new Intl.DateTimeFormat("en-TN-u-ca-islamic", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowParam = encodeURIComponent(tomorrow.toISOString());

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            title="Refreshing…"
            titleColor={colors.accent}
          />
        }
      >
        {!!banner && (
          <View
            style={{
              backgroundColor: "#2a7520",
              borderColor: colors.accent,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 14,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: colors.accent,
                fontFamily: "SFProDisplay-Semibold",
                fontSize: 14,
              }}
            >
              {banner}
            </Text>
          </View>
        )}

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
                color: colors.accent,
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
            backgroundColor: colors.card,
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
            <Text style={{ color: colors.accent, fontSize: 16 }}>
              Next: {nextPrayer.label} in {timeLeft}
            </Text>
          </View>
        )}

        {!nextPrayer && nextDayFajr && (
          <Animated.View style={{ opacity: fadeAnim, marginTop: 20 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: "/components/[date]",
                  params: {
                    date: tomorrowParam,
                    month: tomorrow.getMonth().toString(),
                    year: tomorrow.getFullYear().toString(),
                  },
                })
              }
              style={{
                backgroundColor: colors.card,
                borderRadius: 12,
                paddingVertical: 18,
                paddingHorizontal: 24,
                borderWidth: 2,
                borderColor: colors.accent,
                shadowColor: colors.accent,
                shadowOpacity: 0.6,
                shadowRadius: 8,
                elevation: 5,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 18,
                  fontFamily: "SFProDisplay-Bold",
                  textAlign: "center",
                  marginBottom: 4,
                }}
              >
                Finished all prayers!
              </Text>
              <Text
                style={{
                  color: "white",
                  fontSize: 16,
                  fontFamily: "SFProDisplay-Semibold",
                  textAlign: "center",
                }}
              >
                Tap to see tomorrow’s prayer times
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
