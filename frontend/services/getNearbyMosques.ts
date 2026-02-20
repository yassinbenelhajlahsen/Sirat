import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

export interface Mosque {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export async function getNearbyMosques(
  lat?: number,
  lng?: number
): Promise<Mosque[]> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error("Permission denied");

  let latitude = lat;
  let longitude = lng;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    const loc = await Location.getCurrentPositionAsync({});
    latitude = loc.coords.latitude;
    longitude = loc.coords.longitude;
  }

  const url = `${API_BASE_URL}/api/mosque/nearby?latitude=${latitude}&longitude=${longitude}&radius=3000`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mosque API error: ${res.status}`);
  }

  const json = await res.json();

  if (!json.success || !Array.isArray(json.data)) return [];
  return json.data;
}

/**
 * Cached wrapper for getNearbyMosques()
 * - Stores results in AsyncStorage
 * - Returns cached data instantly if still valid
 * - Falls back to live fetch if expired or not found
 */
export async function getCachedMosques(
  lat?: number,
  lng?: number,
  cacheDurationMs = 86400000
): Promise<Mosque[]> {
  try {
    let latitude = lat;
    let longitude = lng;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      const loc = await Location.getCurrentPositionAsync({});
      latitude = loc.coords.latitude;
      longitude = loc.coords.longitude;
    }

    const cacheKey = `mosques_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
    const cached = await AsyncStorage.getItem(cacheKey);

    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheDurationMs) {
        return data;
      }
    }
    const freshData = await getNearbyMosques(latitude, longitude);
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ data: freshData, timestamp: Date.now() })
    );
    return freshData;
  } catch (error) {
    console.error("Error fetching cached mosques:", error);
    return [];
  }
}
