import { Request, Response } from "express";
import { getNearbyMosques } from "../services/googleMapsService.js";

export async function getNearbyMosquesHandler(req: Request, res: Response) {
  try {
    const { latitude, longitude, radius } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: "Missing required parameters: latitude and longitude",
      });
    }

    const lat = Number.parseFloat(String(latitude));
    const lng = Number.parseFloat(String(longitude));
    const rad = radius ? Number.parseInt(String(radius), 10) : 3000;

    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
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

    if (Number.isNaN(rad) || rad < 1 || rad > 50000) {
      return res.status(400).json({
        error: "Invalid radius (must be between 1 and 50000 meters)",
      });
    }

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
