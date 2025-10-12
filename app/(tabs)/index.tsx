// app/(tabs)/index.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
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
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  const d = new Date(now);
  d.setHours(hours, minutes, 0, 0);
  return d;
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

  // New state to show whether we're using device location or a manual city
  const [locationLabel, setLocationLabel] = useState<string>("");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const DEFAULT_METHOD = 2;
  const DEFAULT_CITY: City = CITIES[0];

  // ---- Settings helpers ----
  async function readSettings(): Promise<PrayerSettings> {
    const raw = await AsyncStorage.getItem("prayerSettings");
    if (!raw) {
      return { useLocation: true, method: DEFAULT_METHOD, city: DEFAULT_CITY };
    }
    const base = JSON.parse(raw) as PrayerSettings & { cityKey?: string };
    let city: City | undefined = base.city;
    if (!city && base.cityKey) {
      city = CITIES.find((c) => cityKey(c) === base.cityKey) ?? DEFAULT_CITY;
    }
    return {
      useLocation: base.useLocation ?? true,
      method: base.method ?? DEFAULT_METHOD,
      city: city ?? DEFAULT_CITY,
    };
  }

  async function writeSettings(s: PrayerSettings) {
    const save = {
      useLocation: s.useLocation,
      method: s.method,
      cityKey: s.city ? cityKey(s.city) : undefined,
      city: s.city,
    };
    await AsyncStorage.setItem("prayerSettings", JSON.stringify(save));
    if (!s.useLocation && s.city) {
      await AsyncStorage.setItem("selectedCity", cityKey(s.city));
    }
    // Notify anyone interested, like the notification service
    try {
      // @ts-ignore optional chaining for web safety
      DeviceEventEmitter?.emit?.("settingsChanged", save);
    } catch {}
  }

  async function osAllowsLocation(): Promise<boolean> {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    const perm = await Location.getForegroundPermissionsAsync();
    return servicesEnabled && perm.status === "granted";
  }
  // Add this helper near your other helpers
async function updateLocationLabel(effective: PrayerSettings) {
  try {
    if (effective.useLocation) {
      // Try last known first to avoid a slow prompt
      let pos = await Location.getLastKnownPositionAsync();
      if (!pos) {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,
          mayShowUserSettingsDialog: false,
        });
      }
      const { latitude, longitude } = pos.coords;
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const p = places?.[0];
      const city =
        p?.city || p?.district || p?.subregion || p?.region || "your area";
      const cc = p?.isoCountryCode || p?.country || "";
      setLocationLabel(
        `${city}${cc ? ", " + cc : ""}`
      );
    } else {
      setLocationLabel(
        `${effective.city?.name ?? "Unknown"}`
      );
    }
  } catch {
    // Fallback if anything fails
    setLocationLabel(
      effective.useLocation ? "Using device location" :
      `${effective.city?.name ?? "Unknown"}`
    );
  }
}

  /**
   * Read settings, enforce sync with the OS, persist if adjusted, and return effective settings.
   * Rule:
   * - If useLocation is true but OS blocks, flip to false and persist.
   * - Otherwise leave as is.
   */
  async function readSyncedSettings(): Promise<PrayerSettings> {
    let s = await readSettings();
    if (s.useLocation) {
      const canUse = await osAllowsLocation();
      if (!canUse) {
        s = { ...s, useLocation: false, city: s.city ?? DEFAULT_CITY };
        await writeSettings(s);
      }
    }
    return s;
  }

  // ---- Data load ----
  const loadData = async () => {
    try {
      setLoading(true);
      setPrayerTimes([]);
      setNextPrayer(null);
      setNextDayFajr(null);
      setTimeLeft("");
      fadeAnim.setValue(0);

      const effective = await readSyncedSettings();
      await updateLocationLabel(effective);
      const times = await getPrayerTimesToday(effective);
      setPrayerTimes(times);

      const now = new Date();
      let foundNext = false;
      for (const pt of times) {
        const timeObj = parseTimeToDate(pt.time);
        if (timeObj > now) {
          setNextPrayer({ ...pt, dateObj: timeObj });
          foundNext = true;
          break;
        }
      }

      if (!foundNext) {
        // As a simple placeholder, show next-day Fajr label from the same function
        const tomorrowTimes = await getPrayerTimesToday(effective);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Re-sync on foreground since user may change iOS settings
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (s) => {
      if (s === "active") {
        await loadData();
      }
    });
    return () => sub.remove();
  }, []);

  // React to in-app settings changes
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("settingsChanged", async () => {
      await loadData();
    });
    return () => sub.remove();
  }, []);

  // Initial launch
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!nextPrayer) return;
    setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    const id = setInterval(() => {
      setTimeLeft(getTimeUntil(nextPrayer.dateObj));
    }, 1000);
    return () => clearInterval(id);
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

          {/* Location display (manual or using device) */}
          {locationLabel ? (
            <Text
              style={{
                color: colors.accent,
                fontSize: 16,
                fontFamily: "SFProDisplay-Semibold",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              {locationLabel}
            </Text>
          ) : null}

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
