import express from "express";
import rateLimit from "express-rate-limit";
import { getNearbyMosquesHandler } from "../controllers/mosqueController.js";

const router = express.Router();

const nearbyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
});

router.get("/nearby", nearbyLimiter, getNearbyMosquesHandler);

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "mosque",
    timestamp: new Date().toISOString(),
  });
});

export default router;
