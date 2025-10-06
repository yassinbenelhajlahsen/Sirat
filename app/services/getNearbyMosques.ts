import Constants from "expo-constants";
import * as Location from "expo-location";
const { GOOGLE_MAPS_API_KEY } = Constants.expoConfig.extra;

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

  if (!latitude || !longitude) {
    const loc = await Location.getCurrentPositionAsync({});
    latitude = loc.coords.latitude;
    longitude = loc.coords.longitude;
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=3000&type=mosque&key=${GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();

  if (!json.results) return [];

  return json.results.map((r: any) => ({
    id: r.place_id,
    name: r.name,
    address: r.vicinity || r.formatted_address || "No address available",
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  }));
}
