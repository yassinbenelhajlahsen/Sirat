// app/(tabs)/mosque.tsx

import * as Location from "expo-location";
import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MOCK_MOSQUES from "../util/mock_mosques";


export default function MosqueScreen() {
  const [location, setLocation] = useState<null | {
    latitude: number;
    longitude: number;
  }>(null);

useEffect(() => {
  (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log("Permission status:", status); // add this
    if (status !== "granted") return;

    const loc = await Location.getCurrentPositionAsync({});
    console.log("Location:", loc); // and this
    setLocation({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  })();
}, []);
const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={styles.title}>Mosques</Text>
        <Text style={styles.header}>Nearby</Text>

        <FlatList
          data={MOCK_MOSQUES}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.address}>{item.address}</Text>
            </View>
          )}
          style={{ marginBottom: 20 }}
        />
        <Text style={styles.header}>Map</Text>

        <TouchableOpacity style={styles.mapContainer} onPress={() => router.push("/components/map")}>
          <MapView
            style={StyleSheet.absoluteFillObject}
            initialRegion={
              location
                ? {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }
                : {
                    latitude: 40.634,
                    longitude: -74.026,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }
            }
            showsUserLocation={true}
          >
            {MOCK_MOSQUES.map((mosque) => (
              <Marker
                key={mosque.id}
                coordinate={{ latitude: mosque.lat, longitude: mosque.lng }}
                title={mosque.name}
                description={mosque.address}
              />
            ))}
          </MapView>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#134b0a",
  },
  title: {
    color: "white",
    fontFamily: "SFProDisplay-Bold",
    fontSize: 36,
    marginBottom: 8,
  },
  header: {
    color: "#DABA69",
    fontSize: 22,
    fontFamily: "SFProDisplay-Bold",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#1a5f0e",
    borderRadius: 14,
    padding: 16,
    marginBottom: 15,
    shadowColor: "#000",
    shadowRadius: 4,
    shadowOpacity: 0.15,
    elevation: 2,
  },
  name: {
    color: "white",
    fontFamily: "SFProDisplay-Semibold",
    fontSize: 20,
  },
  address: {
    color: "white",
    fontFamily: "SFProDisplay-Regular",
    fontSize: 16,
    marginTop: 4,
    opacity: 0.85,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
  },
});
