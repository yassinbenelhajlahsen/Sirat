import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Linking,
  Platform,
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
} from "../services/getNearbyMosques";

export default function MosqueScreen() {
  const router = useRouter();
  const [location, setLocation] = useState<null | {
    latitude: number;
    longitude: number;
  }>(null);
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;
        setLocation({ latitude, longitude });

        // Load cached instantly
        const cached = await getCachedMosques(latitude, longitude);
        setMosques(cached);

        // Then refresh in background
        const fresh = await getNearbyMosques(latitude, longitude);
        setMosques(fresh);
      } catch (err) {
        console.error("Mosque fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openDirections = async (mosque: Mosque) => {
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${mosque.lat},${mosque.lng}&dirflg=d`
        : `https://www.google.com/maps/dir/?api=1&destination=${mosque.lat},${mosque.lng}&travelmode=driving`;

    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
    else Alert.alert("Error", "Unable to open map directions");
  };

  if (loading || !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#DABA69" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: Mosque }) => {
    const scale = new Animated.Value(1);

    const onPressIn = () =>
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
    const onPressOut = () =>
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openDirections(item)}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={styles.card}
        >
          <View style={styles.cardHeader}>
            <FontAwesome5 name="mosque" size={22} color="#DABA69" solid />
            <Text style={styles.name}>{item.name}</Text>
          </View>
          <Text style={styles.address}>{item.address}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Mosques</Text>
        <Text style={styles.header}>Nearby</Text>

        <FlatList
          data={mosques.slice(0, 3)}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          style={{ marginBottom: 24 }}
        />

        <Text style={styles.header}>Map</Text>

        <TouchableOpacity
          style={styles.mapContainer}
          onPress={() => router.push("/components/map")}
          activeOpacity={0.9}
        >
          <MapView
            style={StyleSheet.absoluteFillObject}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation
            customMapStyle={customMapStyle}
          >
            {mosques.map((mosque) => (
              <Marker
                key={mosque.id}
                coordinate={{ latitude: mosque.lat, longitude: mosque.lng }}
                tracksViewChanges={false}
              >
                <View style={styles.pinContainer}>
                  <FontAwesome5 name="mosque" size={18} color="#134b0a" />
                </View>

                <Callout tooltip>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{mosque.name}</Text>
                    <Text style={styles.calloutAddress}>{mosque.address}</Text>
                    <TouchableOpacity
                      style={styles.directionButton}
                      onPress={() => openDirections(mosque)}
                    >
                      <Ionicons name="navigate" size={14} color="#134b0a" />
                      <Text style={styles.directionText}>Directions</Text>
                    </TouchableOpacity>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const customMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0c3605" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#DABA69" }] },
  { featureType: "poi.place_of_worship", stylers: [{ color: "#134b0a" }] },
];

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#134b0a" },
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    color: "white",
    fontFamily: "SFProDisplay-Bold",
    fontSize: 36,
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  header: {
    color: "#DABA69",
    fontSize: 22,
    fontFamily: "SFProDisplay-Bold",
    marginBottom: 16,
    marginTop: 4,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  card: {
    backgroundColor: "#1a5f0e",
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(218,186,105,0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  name: {
    color: "white",
    fontFamily: "SFProDisplay-Semibold",
    fontSize: 19,
    flexShrink: 1,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  address: {
    color: "white",
    fontFamily: "SFProDisplay-Regular",
    fontSize: 15,
    opacity: 0.85,
    marginBottom: 4,
  },
  mapContainer: {
    height: 230,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(218,186,105,0.25)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  pinContainer: {
    backgroundColor: "#DABA69",
    borderRadius: 30,
    padding: 5,
    borderWidth: 2,
    borderColor: "#134b0a",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  callout: {
    backgroundColor: "#134b0a",
    borderRadius: 12,
    padding: 10,
    width: 200,
    borderColor: "#DABA69",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  calloutTitle: {
    color: "#DABA69",
    fontFamily: "SFProDisplay-Bold",
    fontSize: 16,
    marginBottom: 4,
    textAlign: "center",
  },
  calloutAddress: {
    color: "white",
    fontFamily: "SFProDisplay-Regular",
    fontSize: 13,
    opacity: 0.9,
    marginBottom: 8,
    textAlign: "center",
  },
  directionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DABA69",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  directionText: {
    color: "#134b0a",
    fontWeight: "600",
    marginLeft: 5,
    fontSize: 13,
    textAlign: "center",
  },
});
