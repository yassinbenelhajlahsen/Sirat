import axios from "axios";
import { ENV } from "../config/env.js";

interface GoogleNearbySearchResponse {
  status: string;
  error_message?: string;
  results?: Array<{
    place_id: string;
    name: string;
    vicinity?: string;
    formatted_address?: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

export interface Mosque {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface NearbyMosquesParams {
  latitude: number;
  longitude: number;
  radius?: number;
}

export async function getNearbyMosques({
  latitude,
  longitude,
  radius = 3000,
}: NearbyMosquesParams): Promise<Mosque[]> {
  if (!ENV.GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is not configured");
  }

  const response = await axios.get<GoogleNearbySearchResponse>(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
    {
      params: {
        location: `${latitude},${longitude}`,
        radius,
        type: "mosque",
        key: ENV.GOOGLE_MAPS_API_KEY,
      },
    },
  );

  const payload = response.data;
  if (payload.status !== "OK" && payload.status !== "ZERO_RESULTS") {
    throw new Error(
      `Google Maps API error: ${payload.status} - ${payload.error_message || "Unknown error"}`,
    );
  }

  if (!payload.results || payload.results.length === 0) {
    return [];
  }

  return payload.results.map((result) => ({
    id: result.place_id,
    name: result.name,
    address:
      result.vicinity || result.formatted_address || "No address available",
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
  }));
}
