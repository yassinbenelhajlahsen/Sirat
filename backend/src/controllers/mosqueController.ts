import { Request, Response } from "express";
import { getNearbyMosques } from "../services/googleMapsService.js";

export async function getNearbyMosquesHandler(req: Request, res: Response) {
  try {
    const { latitude, longitude, radius } = req.query;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: "Missing required parameters: latitude and longitude",
      });
    }

    const lat = Number(String(latitude));
    const lng = Number(String(longitude));

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        error:
          "Invalid latitude or longitude values. Latitude must be between -90 and 90, longitude between -180 and 180.",
      });
    }

    const parsedRadius = radius === undefined ? 3000 : Number(String(radius));
    if (!Number.isFinite(parsedRadius)) {
      return res.status(400).json({
        error: "Invalid radius (must be a finite number)",
      });
    }
    const rad = Math.min(Math.max(parsedRadius, 100), 5000);

    const mosques = await getNearbyMosques({
      latitude: lat,
      longitude: lng,
      radius: rad,
    });

    return res.json({
      success: true,
      count: mosques.length,
      data: mosques,
    });
  } catch {
    return res.status(500).json({
      error: "Failed to fetch nearby mosques",
    });
  }
}
