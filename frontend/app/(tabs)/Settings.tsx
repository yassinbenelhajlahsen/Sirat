import { withOpacity, type AppTheme, type ThemeName } from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
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
  Image,
  ImageStyle,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
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
  const { theme, themeName, setTheme } = useTheme();
  const themeColors = theme.colors;
  const styles = useMemo(() => createStyles(theme), [theme]);

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
    CALCULATION_METHODS.map((m) => ({ label: m.name, value: m.id })),
  );
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeItems, setThemeItems] = useState([
    { label: "Default", value: "default" as ThemeName },
    { label: "Dark", value: "dark" as ThemeName },
    { label: "Light", value: "light" as ThemeName },
  ]);
  const methodAnim = useRef(new Animated.Value(0)).current;
  const themeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(methodAnim, {
      toValue: methodOpen ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [methodOpen, methodAnim]);

  useEffect(() => {
    Animated.timing(themeAnim, {
      toValue: themeOpen ? 1 : 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [themeOpen, themeAnim]);

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
            ],
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
            ],
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
    [],
  );
  const cityModalColors = useMemo(
    () =>
      themeName === "light"
        ? {
            bg: withOpacity(themeColors.black, 0.28),
            card: withOpacity(themeColors.primaryLift, 0.98),
            cardAlt: withOpacity(themeColors.primarySurfaceAlt, 0.46),
            text: themeColors.offWhite,
            accent: themeColors.primaryBorder,
            divider: withOpacity(themeColors.primaryBorder, 0.45),
            placeholder: withOpacity(themeColors.grayDark, 0.92),
          }
        : undefined,
    [themeColors, themeName],
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
      style={({ pressed }) => [
        styles.visitSiteButton,
        {
          backgroundColor: pressed
            ? withOpacity(themeColors.white, 0.04)
            : withOpacity(themeColors.primaryDeep, 0.4),
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={styles.visitSiteRow}>
        <Text style={styles.visitSiteText}>Visit our site</Text>
        <Text style={styles.visitSiteArrow}>↗</Text>
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
      style={styles.screen}
    >
      <Image
        source={require("@/assets/patterns/islamic-gold2.png")}
        style={styles.patternOverlay}
      />
      <SafeAreaView style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: footerPadding },
          ]}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.eyebrow}>Preferences</Text>
            <Text
              accessibilityRole="header"
              style={[styles.title, isSmall ? styles.titleSmall : undefined]}
            >
              Settings
            </Text>
            <Text style={styles.titleSubtitle}>
              Manage prayer calculations, location behavior, and reminder
              preferences.
            </Text>
          </View>
          <View
            style={[
              styles.sectionHeaderBlock,
              useLocation ? styles.sectionHeaderBlockTight : undefined,
            ]}
          >
            <Text style={styles.sectionGroupTitle}>Appearance</Text>
            <Text style={styles.sectionGroupDescription}>
              Choose your app theme.
            </Text>
          </View>

          <View style={[styles.sectionTop, styles.appearanceDropdownSection]}>
            <Animated.View
              style={{
                transform: [
                  {
                    scale: themeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.03],
                    }),
                  },
                ],
              }}
            >
              <DropDownPicker
                open={themeOpen}
                value={themeName}
                items={themeItems}
                zIndex={3200}
                zIndexInverse={800}
                setOpen={setThemeOpen}
                setItems={setThemeItems}
                setValue={(valueOrUpdater) => {
                  const nextValue =
                    typeof valueOrUpdater === "function"
                      ? valueOrUpdater(themeName)
                      : valueOrUpdater;
                  if (!nextValue || nextValue === themeName) return;
                  void setTheme(nextValue as ThemeName);
                }}
                onOpen={() => setMethodOpen(false)}
                style={{
                  backgroundColor: withOpacity(themeColors.primaryDeep, 0.4),
                  borderColor: withOpacity(themeColors.accent, 0.4),
                  minHeight: 50,
                  borderRadius: 12,
                  marginBottom: themeOpen ? 12 : 0,
                }}
                dropDownContainerStyle={{
                  backgroundColor: withOpacity(themeColors.primaryDeep, 0.9),
                  borderColor: withOpacity(themeColors.accent, 0.4),
                  borderRadius: 12,
                  zIndex: 2900,
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
          <View style={styles.sectionHeaderBlock}>
            <Text style={styles.sectionGroupTitle}>Prayer Times</Text>
            <Text style={styles.sectionGroupDescription}>
              Configure how daily timings are calculated and whether your city
              or device location is used.
            </Text>
          </View>

          {/* Calculation Method */}
          <View style={styles.sectionTop}>
            <Text style={styles.sectionTitle}>Calculation Method</Text>
            <Text style={styles.sectionDescription}>
              Select the authority used to compute prayer schedules.
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
                onOpen={() => setThemeOpen(false)}
                style={{
                  backgroundColor: withOpacity(themeColors.primaryDeep, 0.4),
                  borderColor: withOpacity(themeColors.accent, 0.4),
                  minHeight: 50,
                  borderRadius: 12,
                  marginBottom: methodOpen ? 12 : 0,
                }}
                dropDownContainerStyle={{
                  backgroundColor: withOpacity(themeColors.primaryDeep, 0.9),
                  borderColor: withOpacity(themeColors.accent, 0.4),
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
            style={[
              styles.section,
              {
                marginTop: 18,
                transform: [{ scale: toggleScale }],
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <View style={styles.rowTextBlock}>
                <Text
                  style={[
                    styles.rowTitle,
                    isSmall ? styles.rowTitleSmall : undefined,
                  ]}
                  numberOfLines={1}
                >
                  Use My Location
                </Text>
                <Text
                  style={[
                    styles.rowSubtitle,
                    isSmall ? styles.rowSubtitleSmall : undefined,
                  ]}
                  numberOfLines={2}
                >
                  {permissionStatus === "granted"
                    ? "Using live location. Turn this off to choose a fixed city."
                    : "Enable to use your current location. Turn off for manual city mode."}
                </Text>
              </View>

              <View style={styles.switchWrap}>
                <Switch
                  accessibilityLabel="Use my location"
                  value={useLocation}
                  onValueChange={handleToggle}
                  trackColor={{
                    false: themeColors.grayDark,
                    true: theme.name === "light" ? "#DABA69" : themeColors.accent,
                  }}
                  thumbColor={useLocation ? "#FFFFFF" : themeColors.grayMuted}
                />
              </View>
            </View>
          </Animated.View>

          {/* Manual city selector */}
          <Animated.View
            pointerEvents={useLocation ? "none" : "auto"}
            accessibilityElementsHidden={useLocation}
            style={[
              styles.section,
              {
                marginTop: useLocation ? 10 : 18,
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
                  outputRange: [0, 170],
                }),
                overflow: "hidden",
              },
            ]}
          >
            <Text style={styles.sectionTitle}>Manual City</Text>
            <Text style={styles.sectionDescription}>
              Used when location is disabled for a stable prayer schedule.
            </Text>

            <Pressable
              onPress={() => setCityModalVisible(true)}
              accessibilityRole="button"
              style={styles.cityButton}
            >
              <Text style={styles.cityButtonText}>
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
            colors={cityModalColors}
          />

          {/* Notifications section: the master toggle mirrors OS and opens Settings on press */}
          <NotificationSettings notifStatus={notifStatus} />

          <View style={styles.sectionHeaderBlock}>
            <Text style={styles.sectionGroupTitle}>About</Text>
            <Text style={styles.sectionGroupDescription}>
              Learn more about Sirat and access external resources.
            </Text>
          </View>

          {/* Visit site button */}
          <View style={styles.footer}>
            <VisitSiteButton />
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (theme: AppTheme) => {
  const themeColors = theme.colors;
  const isLight = theme.name === "light";

  return StyleSheet.create({
    screen: { flex: 1 },
    scrollView: { zIndex: 0 },
    scrollContent: { paddingTop: 2 },
    patternOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.05,
      resizeMode: "repeat",
      width: "100%",
      height: "100%",
    },
    titleContainer: { paddingTop: 10, paddingHorizontal: 20 },
    eyebrow: {
      color: withOpacity(themeColors.accent, 0.9),
      fontSize: 12,
      fontFamily: "SFProDisplay-Semibold",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    title: {
      color: themeColors.white,
      fontFamily: "SFProDisplay-Bold",
      fontSize: 38,
      marginTop: 2,
    },
    titleSmall: { fontSize: 34 },
    titleSubtitle: {
      color: withOpacity(themeColors.white, 0.85),
      fontSize: 14,
      fontFamily: "SFProDisplay-Regular",
      marginTop: 6,
      lineHeight: 20,
    },
    sectionHeaderBlock: {
      paddingHorizontal: 20,
      marginTop: 20,
    },
    sectionGroupTitle: {
      color: themeColors.accent,
      fontSize: 13,
      fontFamily: "SFProDisplay-Semibold",
      textTransform: "uppercase",
      letterSpacing: 0.9,
    },
    sectionGroupDescription: {
      color: withOpacity(themeColors.white, 0.72),
      fontSize: 12,
      fontFamily: "SFProDisplay-Regular",
      marginTop: 4,
      lineHeight: 18,
    },
    sectionTop: {
      paddingHorizontal: 20,
      paddingTop: 14,
      zIndex: 2000,
    },
    appearanceDropdownSection: {
      zIndex: 3000,
      elevation: 12,
    },
    section: {
      paddingHorizontal: 20,
    },
    sectionHeaderBlockTight: {
      marginTop: 10,
    },
    sectionTitle: {
      color: themeColors.white,
      fontSize: 16,
      marginBottom: 4,
      fontFamily: "SFProDisplay-Semibold",
    },
    sectionDescription: {
      color: withOpacity(themeColors.white, 0.74),
      fontSize: 12,
      marginBottom: 10,
      fontFamily: "SFProDisplay-Regular",
      lineHeight: 17,
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rowTextBlock: { flex: 1, paddingRight: 12 },
    rowTitle: {
      color: themeColors.white,
      fontSize: 16,
      fontFamily: "SFProDisplay-Semibold",
    },
    rowTitleSmall: { fontSize: 15 },
    rowSubtitle: {
      color: themeColors.white,
      opacity: 0.8,
      fontSize: 13,
      marginTop: 2,
    },
    rowSubtitleSmall: { fontSize: 12 },
    switchWrap: { marginLeft: 8 },
    cityButton: {
      backgroundColor: isLight
        ? withOpacity(themeColors.primarySurface, 0.9)
        : withOpacity(themeColors.primaryDeep, 0.4),
      borderColor: isLight
        ? withOpacity(themeColors.primaryBorder, 0.85)
        : withOpacity(themeColors.accent, 0.4),
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    cityButtonText: {
      color: isLight ? themeColors.offWhite : themeColors.white,
      fontSize: 15,
      fontFamily: "SFProDisplay-Semibold",
    },
    footer: {
      paddingHorizontal: 16,
      marginTop: 10,
      alignItems: "center",
    },
    visitSiteButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
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
    },
    visitSiteRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    visitSiteText: {
      color: themeColors.white,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: "SFProDisplay-Semibold",
      letterSpacing: 0.2,
      marginRight: 8,
    },
    visitSiteArrow: {
      color: themeColors.accent,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: "SFProDisplay-Semibold",
      opacity: 0.95,
    },
  });
};
