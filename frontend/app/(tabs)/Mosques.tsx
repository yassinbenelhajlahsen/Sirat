import {
  withOpacity,
  type AppTheme,
} from "@/constants/theme";
import { useTheme } from "@/context/ThemeContext";
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  InteractionManager,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getCachedMosques,
  getNearbyMosques,
  Mosque,
} from "../../services/getNearbyMosques";
import PressableScale from "../components/PressableScale";

type GeneratedStyles = ReturnType<typeof createStyles>;

const ShimmerCard = ({ styles }: { styles: GeneratedStyles }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  return (
    <View style={styles.animatedCard}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Animated.View
            style={[styles.shimmerIcon, { opacity }]}
          />
          <Animated.View
            style={[styles.shimmerTitle, { opacity }]}
          />
        </View>
        <Animated.View
          style={[styles.shimmerAddress, { opacity }]}
        />
      </View>
    </View>
  );
};

const SkeletonList = ({ styles }: { styles: GeneratedStyles }) => (
  <View style={styles.list}>
    {[0, 1, 2].map((i) => (
      <ShimmerCard key={i} styles={styles} />
    ))}
  </View>
);

type Perm = "undetermined" | "denied" | "granted";

function distanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) *
      Math.cos(toRad(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatDistanceLabel(km: number) {
  if (!Number.isFinite(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

export default function MosqueScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const customMapStyle = useMemo(() => {
    if (theme.name === "light") return undefined;
    return createCustomMapStyle(colors);
  }, [theme.name, colors]);

  const router = useRouter();

  const [permissionStatus, setPermissionStatus] =
    useState<Perm>("undetermined");
  const [servicesOn, setServicesOn] = useState<boolean | null>(null);
  const [location, setLocation] = useState<null | {
    latitude: number;
    longitude: number;
  }>(null);
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingFresh, setFetchingFresh] = useState(false);
  const [openingMap, setOpeningMap] = useState(false);

  const checkStatus = async () => {
    const sOn = await Location.hasServicesEnabledAsync();
    setServicesOn(sOn);
    const perm = await Location.getForegroundPermissionsAsync();
    setPermissionStatus(perm.status as Perm);
  };

  const requestPermissionAndLoad = async () => {
    try {
      setLoading(true);
      const sOn = await Location.hasServicesEnabledAsync();
      setServicesOn(sOn);

      // If services are off, don't request permission yet — show CTA
      if (!sOn) {
        setLoading(false);
        return;
      }

      let perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      setPermissionStatus(perm.status as Perm);

      if (perm.status !== "granted") {
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;
      setLocation({ latitude, longitude });

      // Fast cached fill
      const cached = await getCachedMosques(latitude, longitude);
      setMosques(cached);

      // Fresh network fetch
      setFetchingFresh(true);
      try {
        const fresh = await getNearbyMosques(latitude, longitude);
        setMosques(fresh);
      } catch (fetchErr) {
        console.error("Mosque fetch error:", fetchErr);
        if (cached.length === 0) {
          Alert.alert("Error", "Failed to load nearby mosques.");
        }
      }
    } catch (err) {
      console.error("Mosque load error:", err);
      Alert.alert("Error", "Failed to load nearby mosques.");
    } finally {
      setFetchingFresh(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus()
      .then(requestPermissionAndLoad)
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const openDeviceSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert(
        "Open Settings",
        "Unable to open settings. Please open device settings and grant Location permission.",
      );
    }
  };

  const openLocationServicesHelp = () => {
    Alert.alert(
      "Turn On Location Services",
      Platform.select({
        ios: "Go to Settings → Privacy & Security → Location Services and turn it on, then open Sirat and grant access.",
        android:
          "Turn on Location in Quick Settings or Settings → Location, then open Sirat and grant access.",
        default: "Please enable Location Services on your device.",
      }) as string,
    );
  };

  const openDirections = async (lat: number, lng: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nativeApple = `maps://?daddr=${lat},${lng}&dirflg=d`;
    const webApple = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    try {
      if (await Linking.canOpenURL(nativeApple)) {
        await Linking.openURL(nativeApple);
        return;
      }
      await Linking.openURL(webApple);
    } catch (err) {
      console.warn("openDirections error:", err);
      Alert.alert("Error", "Unable to open Maps for directions");
    }
  };

  const openFullMap = () => {
    if (openingMap) return;
    setOpeningMap(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    InteractionManager.runAfterInteractions(() => {
      router.push("/components/map");
      setTimeout(() => setOpeningMap(false), 450);
    });
  };

  const needLocationGate = useMemo(() => {
    if (loading) return false;
    if (servicesOn === false) return true;
    if (permissionStatus !== "granted") return true;
    if (!location) return true;
    return false;
  }, [loading, servicesOn, permissionStatus, location]);

  const InfoBanner = ({
    icon,
    title,
    message,
    actions,
    iconColor = colors.white,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    message: string;
    actions?: React.ReactNode;
    iconColor?: string;
  }) => (
    <View style={styles.banner}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <View style={styles.bannerBody}>
        <Text style={styles.bannerTitle}>{title}</Text>
        <Text style={styles.bannerText}>{message}</Text>
        {actions}
      </View>
    </View>
  );

  if (needLocationGate && !loading) {
    const servicesOff = servicesOn === false;
    const denied = permissionStatus === "denied";
    const undetermined = permissionStatus === "undetermined";

    return (
      <LinearGradient
        colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Image
          source={require("../../assets/patterns/islamic-gold2.png")}
          style={styles.patternOverlay}
        />

        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <View style={styles.headerSection}>
              <Text style={styles.eyebrow}>Explore</Text>
              <Text style={styles.title}>Nearby Mosques</Text>
              <Text style={styles.subtitle}>
                Enable location to discover masajid around you.
              </Text>
            </View>
            <View style={styles.gateContent}>
              {servicesOff ? (
                <InfoBanner
                  icon="location"
                  title="Location Services Off"
                  message="Location is required to show nearby mosques and center the map."
                  actions={
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={styles.ctaPrimary}
                        onPress={openLocationServicesHelp}
                        accessibilityRole="button"
                        accessibilityLabel="How to turn on location services"
                      >
                        <Text style={styles.ctaPrimaryText}>
                          How to turn on
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ctaSecondary}
                        onPress={requestPermissionAndLoad}
                        accessibilityRole="button"
                        accessibilityLabel="Retry location setup"
                      >
                        <Text style={styles.ctaSecondaryText}>
                          I turned it on
                        </Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              ) : denied ? (
                <InfoBanner
                  icon="location-outline"
                  iconColor={colors.accent}
                  title="Allow Location Access"
                  message="Grant Sirat access to your location for accurate nearby mosque results."
                  actions={
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={styles.ctaPrimary}
                        onPress={openDeviceSettings}
                        accessibilityRole="button"
                        accessibilityLabel="Open device settings"
                      >
                        <Text style={styles.ctaPrimaryText}>Open Settings</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.ctaSecondary}
                        onPress={requestPermissionAndLoad}
                        accessibilityRole="button"
                        accessibilityLabel="Retry location permission"
                      >
                        <Text style={styles.ctaSecondaryText}>Try again</Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              ) : undetermined ? (
                <InfoBanner
                  icon="navigate-outline"
                  title="We need your location"
                  message="Tap enable to find mosques near you. You can disable anytime in Settings."
                  actions={
                    <TouchableOpacity
                      style={styles.ctaPrimary}
                      onPress={requestPermissionAndLoad}
                      accessibilityRole="button"
                      accessibilityLabel="Enable location"
                    >
                      <Text style={styles.ctaPrimaryText}>Enable Location</Text>
                    </TouchableOpacity>
                  }
                />
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const renderItem = ({ item }: { item: Mosque }) => {
    const distanceLabel = location
      ? formatDistanceLabel(
          distanceKm(location.latitude, location.longitude, item.lat, item.lng)
        )
      : null;

    return (
      <PressableScale
        onPress={() => openDirections(item.lat, item.lng)}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`Open directions to ${item.name}`}
        accessibilityHint="Opens your maps app"
      >
        <View style={styles.cardHeader}>
          <FontAwesome5 name="mosque" size={22} color={colors.accent} solid />
          <Text style={styles.name}>{item.name}</Text>
        </View>
        <Text style={styles.address}>{item.address}</Text>
        <View style={styles.cardMetaRow}>
          {distanceLabel ? (
            <View style={styles.distancePill}>
              <Ionicons
                name="walk-outline"
                size={14}
                color={withOpacity(colors.accent, 0.95)}
              />
              <Text style={styles.distancePillText}>{distanceLabel}</Text>
            </View>
          ) : (
            <View />
          )}
          <Text style={styles.cardHint}>Tap for directions</Text>
        </View>
      </PressableScale>
    );
  };

  const emptyNearby =
    !fetchingFresh && (mosques == null || mosques.length === 0);
  const topMosques = mosques.slice(0, 3);
  const previewMosques = mosques.slice(0, 12);

  return (
    <LinearGradient
      colors={[colors.primaryDeep, colors.primary, colors.primaryLift]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <Image
        source={require("../../assets/patterns/islamic-gold2.png")}
        style={styles.patternOverlay}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.container}>
            <View style={styles.headerSection}>
              <Text style={styles.eyebrow}>Explore</Text>
              <Text style={styles.title}>Nearby Mosques</Text>
              <Text style={styles.subtitle}>
                Find a masjid near you and open directions in one tap.
              </Text>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.header}>Nearest</Text>
            </View>
            {loading && mosques.length === 0 ? (
      <SkeletonList styles={styles} />
            ) : emptyNearby ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyRow}>
                  <Ionicons name="search" size={18} color={colors.accent} />
                  <Text style={styles.emptyTextFill}>
                    No mosques found near your current location.
                  </Text>
                </View>
              </View>
            ) : (
              <FlatList
                data={topMosques}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
                style={styles.list}
                contentContainerStyle={styles.listContent}
              />
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.header}>Map Preview</Text>
            </View>
            {!location ? (
              <Animated.View
                style={[
                  styles.mapContainer,
                  {
                    backgroundColor: withOpacity(colors.accent, 0.1),
                    opacity: 0.5,
                  },
                ]}
              />
            ) : (
              <TouchableOpacity
                style={styles.mapContainer}
                activeOpacity={0.94}
                disabled={openingMap}
                onPress={openFullMap}
                accessibilityRole="button"
                accessibilityLabel="Open full mosque map"
              >
                <MapView
                  pointerEvents="none"
                  style={StyleSheet.absoluteFillObject}
                  initialRegion={{
                    latitude: location!.latitude,
                    longitude: location!.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  showsUserLocation
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  customMapStyle={customMapStyle}
                  userInterfaceStyle={theme.name === "light" ? "light" : "dark"}
                >
                  {previewMosques.map((m) => (
                    <Marker
                      key={m.id}
                      coordinate={{ latitude: m.lat, longitude: m.lng }}
                      tracksViewChanges={false}
                    >
                      <View style={styles.pinContainer}>
                        <FontAwesome5
                          name="mosque"
                          size={18}
                          color={colors.primaryMuted}
                        />
                      </View>

                      <Callout tooltip>
                        <View style={styles.callout}>
                          <Text style={styles.calloutTitle}>{m.name}</Text>
                          <Text style={styles.calloutAddress}>{m.address}</Text>
                          <TouchableOpacity
                            style={styles.directionButton}
                            onPress={() => openDirections(m.lat, m.lng)}
                            accessibilityRole="button"
                            accessibilityLabel={`Directions to ${m.name}`}
                          >
                            <Ionicons
                              name="navigate"
                              size={14}
                              color={colors.onAccent}
                            />
                            <Text style={styles.directionText}>Directions</Text>
                          </TouchableOpacity>
                        </View>
                      </Callout>
                    </Marker>
                  ))}
                </MapView>
                {fetchingFresh && (
                  <View style={styles.mapSpinner}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                )}
                {openingMap && (
                  <View style={styles.mapOpeningOverlay}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createCustomMapStyle = (colors: AppTheme["colors"]) => [
  { elementType: "geometry", stylers: [{ color: colors.primaryDark }] },
  { elementType: "labels.text.fill", stylers: [{ color: colors.accent }] },
  { featureType: "poi.place_of_worship", stylers: [{ color: colors.primary }] },
];

const createStyles = (theme: AppTheme) => {
  const { colors, spacing, typography } = theme;

  return StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "transparent" },
  scrollContent: {
    paddingBottom: spacing.xl + spacing.xl,
  },
  container: { flex: 1, padding: spacing.xl },
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
  headerSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: withOpacity(colors.accent, 0.9),
    fontSize: typography.caption,
    fontFamily: "SFProDisplay-Semibold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: colors.white,
    fontFamily: "SFProDisplay-Bold",
    fontSize: 34,
    marginTop: spacing.xs,
    textShadowColor: withOpacity(colors.black, 0.4),
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  subtitle: {
    marginTop: spacing.xs,
    color: withOpacity(colors.white, 0.9),
    fontSize: typography.body,
    lineHeight: 20,
    fontFamily: "SFProDisplay-Regular",
  },
  header: {
    color: colors.accent,
    fontSize: typography.subtitle,
    fontFamily: "SFProDisplay-Bold",
    marginBottom: spacing.sm,
    textShadowColor: withOpacity(colors.black, 0.3),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  banner: {
    backgroundColor: withOpacity(colors.accent, 0.18),
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.35),
    borderRadius: 14,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  gateContent: { flex: 1, marginTop: spacing.md },
  bannerBody: { flex: 1, marginLeft: spacing.sm + 2 },
  bannerTitle: {
    color: colors.accent,
    fontSize: typography.bodyLg,
    fontFamily: "SFProDisplay-Semibold",
  },
  bannerText: {
    color: colors.white,
    opacity: 0.95,
    fontSize: typography.body,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm + 2,
    marginTop: spacing.sm + 2,
    flexWrap: "wrap",
  },
  ctaPrimary: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  ctaPrimaryText: { color: colors.onAccent, fontWeight: "700" },
  ctaSecondary: {
    borderColor: colors.accent,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  ctaSecondaryText: { color: colors.accent, fontWeight: "600" },
  animatedCard: { marginBottom: spacing.lg },
  sectionHeaderRow: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inlineAction: {
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.4),
    borderRadius: 10,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
  },
  inlineActionText: {
    color: colors.accent,
    fontSize: typography.caption,
    fontFamily: "SFProDisplay-Semibold",
  },
  card: {
    backgroundColor: colors.primarySurfaceAlt,
    borderRadius: 18,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.25),
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    marginBottom: spacing.sm - 2,
  },
  name: {
    color: colors.white,
    fontFamily: "SFProDisplay-Semibold",
    fontSize: 19,
    flexShrink: 1,
    textShadowColor: withOpacity(colors.black, 0.25),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  address: {
    color: colors.white,
    fontFamily: "SFProDisplay-Regular",
    fontSize: typography.body + 1,
    opacity: 0.85,
    marginBottom: spacing.xs,
    alignItems: "center",
  },
  cardMetaRow: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: theme.name === "light" ? withOpacity(colors.primarySurface, 0.65) :  withOpacity(colors.white, 0.08),
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.25),
    borderRadius: 999,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  distancePillText: {
    color: withOpacity(colors.accent, 0.95),
    fontSize: typography.caption,
    fontFamily: "SFProDisplay-Semibold",
  },
  cardHint: {
    color: withOpacity(colors.white, 0.7),
    fontSize: typography.caption,
    fontFamily: "SFProDisplay-Regular",
  },
  mapContainer: {
    height: 240,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: spacing.sm - 2,
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.25),
    shadowColor: colors.black,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
    position: "relative",
  },
  mapHint: {
    position: "absolute",
    bottom: spacing.sm + 2,
    left: spacing.sm + 2,
    right: spacing.sm + 2,
    borderRadius: 10,
    backgroundColor: withOpacity(colors.black, 0.35),
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    alignItems: "center",
  },
  mapHintText: {
    color: colors.white,
    fontSize: typography.caption,
    fontFamily: "SFProDisplay-Semibold",
  },
  mapSpinner: {
    position: "absolute",
    right: spacing.sm + 2,
    top: spacing.sm + 2,
    backgroundColor: withOpacity(colors.black, 0.35),
    borderRadius: 12,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm - 2,
  },
  mapOpeningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withOpacity(colors.black, 0.18),
    alignItems: "center",
    justifyContent: "center",
  },
  pinContainer: {
    backgroundColor: colors.accent,
    borderRadius: 30,
    padding: 5,
    borderWidth: 2,
    borderColor: withOpacity(colors.primaryMuted, 0.9),
    shadowColor: colors.black,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  callout: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: spacing.sm + 2,
    width: 200,
    borderColor: colors.accent,
    borderWidth: 1,
    shadowColor: colors.black,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  calloutTitle: {
    color: colors.accent,
    fontFamily: "SFProDisplay-Bold",
    fontSize: 16,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  calloutAddress: {
    color: colors.white,
    fontFamily: "SFProDisplay-Regular",
    fontSize: 13,
    opacity: 0.9,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  directionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: spacing.sm - 3,
    paddingHorizontal: spacing.sm + 2,
    justifyContent: "center",
  },
  directionText: {
    color: colors.onAccent,
    fontWeight: "600",
    marginLeft: spacing.sm - 3,
    fontSize: 13,
    textAlign: "center",
  },
  emptyCard: {
    backgroundColor: withOpacity(colors.white, 0.05),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: withOpacity(colors.accent, 0.25),
    padding: spacing.lg - 2,
    gap: 6,
    marginBottom: spacing.md,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  emptyTextFill: { color: colors.white, fontSize: 15, marginLeft: 10, flex: 1 },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: 8,
  },
  shimmerIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: withOpacity(colors.accent, 0.25),
  },
  shimmerTitle: {
    height: 18,
    borderRadius: 8,
    backgroundColor: withOpacity(colors.accent, 0.25),
    flex: 1,
  },
  shimmerAddress: {
    height: 14,
    borderRadius: 6,
    backgroundColor: withOpacity(colors.accent, 0.15),
    width: "70%",
    marginTop: 2,
  },
  });
};
