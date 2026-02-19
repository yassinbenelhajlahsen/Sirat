// app/(tabs)/index.tsx
import { colors, withOpacity } from "@/constants/theme";
import { requestDua, saveDuaToHistory, type Dua } from "@/services/duaService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  DeviceEventEmitter,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getPrayerTimesToday,
  PrayerSettings,
  PrayerTime,
} from "../../services/prayerTimes";
import CITIES, { City, cityKey } from "../../util/cities";
import getTimeUntil from "../../util/getTimeUntil";
import DuaCard from "../components/DuaCard";
import DuaResultCard from "../components/DuaResultCard";
import PrayerTimesList from "../components/PrayerTimesList";
import PressableScale from "../components/PressableScale";

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

  // Single source of truth label for where times came from
  const [locationLabel, setLocationLabel] = useState<string>("");

  // Dua component state
  const [selectedDua, setSelectedDua] = useState<Dua | null>(null);
  const [duaLoading, setDuaLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

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
    try {
      // @ts-ignore web safety
      DeviceEventEmitter?.emit?.("settingsChanged", save);
    } catch {}
  }

  async function osAllowsLocation(): Promise<boolean> {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    const perm = await Location.getForegroundPermissionsAsync();
    return servicesEnabled && perm.status === "granted";
  }

  /**
   * Read settings, enforce sync with the OS, persist if adjusted, and return effective settings.
   * If useLocation is true but OS blocks, flip to false and persist.
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

  /**
   * Resolve a fresh coordinate and a human label once, then reuse both.
   * Never uses getLastKnownPositionAsync to avoid stale locations.
   */
  async function resolveCoordsAndLabel(effective: PrayerSettings): Promise<{
    coords?: { latitude: number; longitude: number };
    country?: string;
    label: string;
  }> {
    if (!effective.useLocation) {
      return {
        coords: undefined,
        label: effective.city?.name ?? "Unknown",
      };
    }

    // Permission check and prompt if needed
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      const req = await Location.requestForegroundPermissionsAsync();
      perm = req;
    }
    const services = await Location.hasServicesEnabledAsync();
    if (!services || perm.status !== "granted") {
      // Fall back to manual city label if present
      return {
        coords: undefined,
        label: effective.city?.name ?? "Location off",
      };
    }

    // Fresh reading only
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: false,
    });

    let country: string | undefined;
    let label = "";
    try {
      const places = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const p = places?.[0];
      const city =
        p?.city || p?.district || p?.subregion || p?.region || "Your area";
      const cc = p?.isoCountryCode || p?.country || "";
      label = `${city}${cc ? ", " + cc : ""}`;
      country = p?.country || p?.isoCountryCode || undefined;
    } catch {
      // If reverse geocode fails, still show a useful label
      const lat = pos.coords.latitude.toFixed(3);
      const lon = pos.coords.longitude.toFixed(3);
      label = `Lat ${lat}, Lon ${lon}`;
    }

    return {
      coords: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      },
      country,
      label,
    };
  }

  // ---- Dua Handler ----
  const handleDuaSubmit = async (userRequest: string) => {
    try {
      setDuaLoading(true);
      const dua = await requestDua(userRequest);
      setSelectedDua(dua);
      await saveDuaToHistory(dua);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to find a dua");
    } finally {
      setDuaLoading(false);
    }
  };

  // ---- Data load ----
  const loadData = async () => {
    try {
      setLoading(true);
      setPrayerTimes([]);
      setNextPrayer(null);
      setNextDayFajr(null);
      setTimeLeft("");
      fadeAnim.setValue(0);
      setBanner("");

      // 1) Read effective settings
      const effective = await readSyncedSettings();

      // 2) Resolve coordinates and label once
      const { coords, country, label } = await resolveCoordsAndLabel(effective);
      setLocationLabel(label);

      // 3) Fetch times using the exact same coords
      const times = await getPrayerTimesToday(effective, {
        coords,
        country,
      });
      setPrayerTimes(times);

      // 4) Compute next prayer
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

      // 5) If day finished, show tomorrow's Fajr using same coords
      if (!foundNext) {
        const tomorrowTimes = await getPrayerTimesToday(effective, {
          coords,
          country,
        });
        const fajr = tomorrowTimes.find((p) => p.label === "Fajr");
        if (fajr) setNextDayFajr(fajr.time);
      }
    } catch (err) {
      console.error("Error fetching prayer times:", err);
      setBanner(
        "We could not load prayer times right now. Please try again later or set a manual city in Settings.",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to in-app settings changes
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("settingsChanged", async () => {
      await loadData();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial launch
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Smooth keyboard scroll - use keyboardWillShow on iOS for simultaneous animation
  useEffect(() => {
    const keyboardShowEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const showSubscription = Keyboard.addListener(keyboardShowEvent, () => {
      // Scroll past the end to ensure DuaCard is well above keyboard
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 0);
    });

    return () => {
      showSubscription.remove();
    };
  }, []);

  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollToBottom = useCallback((animated: boolean) => {
    // Do it after the current frame, when layout is more likely settled
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    const willShowSub =
      Platform.OS === "ios"
        ? Keyboard.addListener("keyboardWillShow", () => {
            setKeyboardOpen(true);
            // Scroll immediately, same frame as keyboard animation
            requestAnimationFrame(() => scrollToBottom(true));
          })
        : null;

    const didShowSub = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardOpen(true);
      requestAnimationFrame(() => scrollToBottom(false));
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardOpen(false);
    });

    return () => {
      willShowSub?.remove();
      didShowSub.remove();
      hideSub.remove();
    };
  }, [scrollToBottom]);

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
  }, [fadeAnim, nextDayFajr, nextPrayer]);

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
    <LinearGradient
      colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <Image
        source={require("@/assets/patterns/islamic-gold2.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.05,
          resizeMode: "repeat",
          width: "100%",
          height: "100%",
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={-60}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            ref={scrollViewRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            onContentSizeChange={() => {
              if (keyboardOpen) scrollToBottom(false);
            }}
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
                  backgroundColor: colors.primaryLift,
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
                color: colors.white,
                fontSize: 42,
                fontFamily: "SFProDisplay-Bold",
              }}
            >
              Home
            </Text>

            <View style={{ marginTop: 30, alignItems: "center" }}>
              <Text
                style={{
                  color: colors.white,
                  fontSize: 28,
                  fontFamily: "SFProDisplay-Semibold",
                }}
              >
                Today&apos;s Prayer Times
              </Text>

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
                    color: colors.white,
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
                backgroundColor: withOpacity(colors.black, 0.2),
                borderRadius: 18,
                padding: 20,
                borderWidth: 1,
                borderColor: withOpacity(colors.white, 0.08),
                shadowColor: colors.primaryDark,
                shadowOpacity: 0.25,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 16 },
                elevation: 6,

                minHeight: 360, // lock footprint
                justifyContent: "center",
              }}
            >
              <PrayerTimesList
                loading={loading}
                prayerTimes={prayerTimes}
                nextPrayerLabel={nextPrayer?.label ?? null}
              />
            </View>

            <View
              style={{ marginTop: 10, marginBottom: 12, alignItems: "center" }}
            >
              {nextPrayer ? (
                <Text style={{ color: colors.accent, fontSize: 16 }}>
                  Next: {nextPrayer.label} in {timeLeft}
                </Text>
              ) : nextDayFajr ? (
                <Animated.View style={{ opacity: fadeAnim, width: "100%" }}>
                  <PressableScale
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
                      backgroundColor: withOpacity(
                        colors.primarySurfaceAlt,
                        0.25,
                      ),
                      borderRadius: 12,
                      paddingVertical: 18,
                      paddingHorizontal: 24,
                      borderWidth: 2,
                      borderColor: withOpacity(colors.accent, 0.75),
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
                        color: colors.white,
                        fontSize: 16,
                        fontFamily: "SFProDisplay-Semibold",
                        textAlign: "center",
                      }}
                    >
                      Tap to see tomorrow's prayer times
                    </Text>
                  </PressableScale>
                </Animated.View>
              ) : null}
            </View>
            {/* Dua Section */}
            {selectedDua ? (
              <DuaResultCard
                dua={selectedDua}
                onClose={() => setSelectedDua(null)}
              />
            ) : (
              <DuaCard
                onSubmit={handleDuaSubmit}
                loading={duaLoading}
                onInputFocus={() => scrollToBottom(true)}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
