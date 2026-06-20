import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { requireAuth } from "../middleware/requireAuth.js";
import { postSync } from "../controllers/syncController.js";

const router = Router();

const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
});

// Sync payloads carry full logs; allow more than the global 16KB limit.
router.use(express.json({ limit: "1mb" }));
router.use(clerkMiddleware());

/**
 * POST /api/sync
 * Body: { prayer_log?, habits?, habit_log?, settings? }
 * Returns the merged authoritative docs + syncedAt.
 */
router.post("/", syncLimiter, requireAuth, postSync);

export default router;
