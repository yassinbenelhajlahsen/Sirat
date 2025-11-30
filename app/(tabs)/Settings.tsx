import { colors as themeColors, withOpacity } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  DeviceEventEmitter,
  Easing,
  ImageStyle,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { clearPrayerCache } from "../../services/prayerTimes";
import CALCULATION_METHODS from "../../util/calculationMethods";
import CITIES, { City, cityKey } from "../../util/cities";
import CitySearchModal from "../components/CitySearchModal";
import NotificationSettings from "../components/NotificationSettings";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isSmall = width < 360;

  const footerPadding = insets.bottom + 24;

  const [useLocation, setUseLocation] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null); // granted | denied | undetermined | null
  const [notifStatus, setNotifStatus] = useState<string | null>(null); // granted | denied | null
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [methodOpen, setMethodOpen] = useState(false);
  const [method, setMethod] = useState(-1);
  const [methodItems, setMethodItems] = useState(
    CALCULATION_METHODS.map((m) => ({ label: m.name, value: m.id }))
  );
  const methodAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(methodAnim, {
      toValue: methodOpen ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [methodOpen, methodAnim]);

  const locationAnim = useRef(new Animated.Value(useLocation ? 0 : 1)).current;
  const toggleScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(locationAnim, {
      toValue: useLocation ? 0 : 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [useLocation, locationAnim]);

  const handleToggle = async (val: boolean) => {
    Animated.sequence([
      Animated.timing(toggleScale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(toggleScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    if (val) {
      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          Alert.alert(
            "Location is off",
            "Please enable Location Services on your device, then try again.",
            [
              { text: "Open Settings", onPress: () => Linking.openSettings() },
              { text: "Cancel", style: "cancel" },
            ]
          );
          setUseLocation(false);
          return;
        }
        let perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== "granted") {
          perm = await Location.requestForegroundPermissionsAsync();
        }
        setPermissionStatus(perm.status);
        if (perm.status === "granted") {
          setUseLocation(true);
        } else {
          Alert.alert(
            "Permission needed",
            "Sirat needs Location permission for automatic prayer times.",
            [
              { text: "Open Settings", onPress: () => Linking.openSettings() },
              { text: "Cancel", style: "cancel" },
            ]
          );
          setUseLocation(false);
        }
      } catch (err) {
        console.warn("handleToggle enable error:", err);
        setUseLocation(false);
      }
    } else {
      setUseLocation(false);
    }
  };

  const [city, setCity] = useState<City>(CITIES[0]);
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const cityItems = useMemo(
    () =>
      CITIES.map((c) => ({
        label: `${c.name}, ${c.country}`,
        value: cityKey(c),
      })),
    []
  );

  // Initial load: read prayer settings and read current notification permission once
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("prayerSettings");
      if (raw) {
        const parsed = JSON.parse(raw);
        setUseLocation(parsed.useLocation ?? true);
        setMethod(parsed.method ?? -1);
        if (parsed.cityKey) {
          const found = CITIES.find((c) => cityKey(c) === parsed.cityKey);
          if (found) setCity(found);
        } else if (parsed.city) {
          setCity(parsed.city);
        }
      } else {
        const legacy = await AsyncStorage.getItem("selectedCity");
        if (legacy) {
          const found = CITIES.find((c) => cityKey(c) === legacy);
          if (found) setCity(found);
        }
      }

      // Prime notifStatus to drive NotificationSettings master toggle
      try {
        const notifPerm = await Notifications.getPermissionsAsync();
        setNotifStatus(notifPerm.granted ? "granted" : "denied");
      } catch {
        setNotifStatus("denied");
      }

      setSettingsLoaded(true);
    })();
  }, []);

  // Re-sync with OS permissions when returning to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        try {
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          const perm = await Location.getForegroundPermissionsAsync();
          const notifPerm = await Notifications.getPermissionsAsync();

          setPermissionStatus(perm.status);
          setNotifStatus(notifPerm.granted ? "granted" : "denied");

          if (useLocation && (!servicesEnabled || perm.status !== "granted")) {
            setUseLocation(false);
          }
        } catch (e) {
          console.warn("Recheck permissions failed:", e);
          if (useLocation) setUseLocation(false);
        }
      }
    });
    return () => sub.remove();
  }, [useLocation]);

  // Persist + notify on changes
  useEffect(() => {
    const save = async () => {
      const payload = {
        useLocation,
        method,
        cityKey: cityKey(city),
        city,
      };
      await AsyncStorage.setItem("prayerSettings", JSON.stringify(payload));
      if (!useLocation) {
        await AsyncStorage.setItem("selectedCity", cityKey(city));
      }
      clearPrayerCache();
      try {
        // @ts-ignore for web
        DeviceEventEmitter?.emit?.("settingsChanged", payload);
      } catch {}
    };
    if (settingsLoaded) void save();
  }, [useLocation, method, city, settingsLoaded]);

  const selectCityByKey = (value: string) => {
    const selected = CITIES.find((c) => cityKey(c) === value) || CITIES[0];
    setCity(selected);
    setCityModalVisible(false);
  };

  const VisitSiteButton = () => (
    <Pressable
      accessibilityRole="link"
      accessible
      accessibilityLabel="Open Sirat website"
      accessibilityHint="Opens the Sirat website in your browser"
      onPress={() => Linking.openURL("https://sirat.dev").catch(() => {})}
      android_ripple={{
        color: withOpacity(themeColors.white, 0.06),
        borderless: false,
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed
          ? withOpacity(themeColors.white, 0.04)
          : withOpacity(themeColors.primaryDeep, 0.4),
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: withOpacity(themeColors.white, 0.06),
        shadowColor: themeColors.black,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
        width: "100%",
        maxWidth: 520,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: themeColors.white,
            fontSize: 14,
            lineHeight: 20,
            fontFamily: "SFProDisplay-Semibold",
            letterSpacing: 0.2,
            marginRight: 8,
          }}
        >
          Visit our site
        </Text>
        <Text
          style={{
            color: themeColors.accent,
            fontSize: 14,
            lineHeight: 20,
            fontFamily: "SFProDisplay-Semibold",
            opacity: 0.95,
          }}
        >
          ↗
        </Text>
      </View>
    </Pressable>
  );

  return (
    <LinearGradient
      colors={[
        themeColors.primaryDeep,
        themeColors.primary,
        themeColors.primaryLift,
      ]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingBottom: footerPadding,
          }}
          showsVerticalScrollIndicator={false}
          style={{ zIndex: 0 }}
        >
          {/* Title */}
          <View style={{ paddingTop: 10, paddingHorizontal: 20 }}>
            <Text
              accessibilityRole="header"
              style={{
                color: themeColors.white,
                fontFamily: "SFProDisplay-Bold",
                fontSize: isSmall ? 34 : 40,
              }}
            >
              Settings
            </Text>
          </View>

          {/* Calculation Method */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 14,
              zIndex: 2000,
            }}
          >
            <Text
              style={{
                color: themeColors.white,
                fontSize: 16,
                marginBottom: 8,
                fontFamily: "SFProDisplay-Semibold",
              }}
            >
              Calculation Method
            </Text>
            <Animated.View
              style={{
                transform: [
                  {
                    scale: methodAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.03],
                    }),
                  },
                ],
              }}
            >
              <DropDownPicker
                open={methodOpen}
                value={method}
                items={methodItems}
                setOpen={setMethodOpen}
                setValue={setMethod}
                setItems={setMethodItems}
                style={{
                  backgroundColor: themeColors.primarySurfaceAlt,
                  borderColor: themeColors.accent,
                  minHeight: 50,
                  borderRadius: 12,
                  marginBottom: methodOpen ? 12 : 0,
                }}
                dropDownContainerStyle={{
                  backgroundColor: themeColors.primarySurfaceAlt,
                  borderColor: themeColors.accent,
                  borderRadius: 12,
                  zIndex: 3000,
                }}
                textStyle={{
                  color: themeColors.white,
                  fontSize: 16,
                  fontFamily: "SFProDisplay-Semibold",
                }}
                arrowIconStyle={{ tintColor: themeColors.accent } as ImageStyle}
                selectedItemLabelStyle={{
                  color: themeColors.accent,
                  fontFamily: "SFProDisplay-Bold",
                }}
                listItemLabelStyle={{
                  color: themeColors.white,
                  fontFamily: "SFProDisplay-Regular",
                }}
                listMode="SCROLLVIEW"
                placeholder="Select calculation method"
                placeholderStyle={{
                  color: themeColors.grayMedium,
                  fontFamily: "SFProDisplay-Regular",
                }}
                showTickIcon
                tickIconStyle={
                  {
                    tintColor: themeColors.accent,
                  } as ImageStyle
                }
              />
            </Animated.View>
          </View>

          {/* Location toggle */}
          <Animated.View
            style={{
              paddingHorizontal: 20,
              marginTop: 18,
              transform: [{ scale: toggleScale }],
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text
                  style={{
                    color: themeColors.white,
                    fontSize: isSmall ? 15 : 16,
                    fontFamily: "SFProDisplay-Semibold",
                  }}
                  numberOfLines={1}
                >
                  Use My Location
                </Text>
                <Text
                  style={{
                    color: themeColors.white,
                    opacity: 0.8,
                    fontSize: isSmall ? 12 : 13,
                    marginTop: 2,
                  }}
                  numberOfLines={2}
                >
                  {permissionStatus === "granted"
                    ? "Location permission granted. Turn off to select a city manually."
                    : "Tap to enable Location. Turn off to select a city manually."}
                </Text>
              </View>

              <View style={{ marginLeft: 8 }}>
                <Switch
                  accessibilityLabel="Use my location"
                  value={useLocation}
                  onValueChange={handleToggle}
                  trackColor={{
                    false: themeColors.grayDark,
                    true: themeColors.accent,
                  }}
                  thumbColor={
                    useLocation ? themeColors.white : themeColors.grayMuted
                  }
                />
              </View>
            </View>
          </Animated.View>

          {/* Manual city selector */}
          <Animated.View
            pointerEvents={useLocation ? "none" : "auto"}
            accessibilityElementsHidden={useLocation}
            style={{
              paddingHorizontal: 20,
              marginTop: 18,
              opacity: locationAnim,
              transform: [
                {
                  translateY: locationAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
              maxHeight: locationAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 120],
              }),
              overflow: "hidden",
            }}
          >
            <Text
              style={{
                color: themeColors.white,
                fontSize: 16,
                marginBottom: 8,
                fontFamily: "SFProDisplay-Semibold",
              }}
            >
              Manual City
            </Text>

            <Pressable
              onPress={() => setCityModalVisible(true)}
              accessibilityRole="button"
              style={{
                backgroundColor: themeColors.primarySurfaceAlt,
                borderColor: themeColors.accent,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 14,
              }}
            >
              <Text style={{ color: themeColors.white, fontSize: 15 }}>
                {city
                  ? `${city.name}${city.country ? ", " + city.country : ""}`
                  : "Select City"}
              </Text>
            </Pressable>
          </Animated.View>

          {/* City search modal */}
          <CitySearchModal
            visible={cityModalVisible}
            onClose={() => setCityModalVisible(false)}
            onSelectKey={selectCityByKey}
            items={cityItems}
          />

          {/* Notifications section: the master toggle mirrors OS and opens Settings on press */}
          <NotificationSettings notifStatus={notifStatus} />

          {/* Visit site button */}
          <View
            style={{
              paddingHorizontal: 16,
              marginTop: 24,
              alignItems: "center",
            }}
          >
            <VisitSiteButton />
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
