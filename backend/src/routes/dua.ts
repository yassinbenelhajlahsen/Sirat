import { Router } from "express";
import rateLimit from "express-rate-limit";
import { health, matchDua } from "../controllers/duaController.js";

const router = Router();

const duaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
});

/**
 * POST /api/dua
 * Match user request to a dua
 * Body: { userRequest: string }
 * Response: { dua: Dua, matchSource: "ai" | "fallback" }
 */
router.post("/", duaLimiter, matchDua);

/**
 * GET /api/dua/health
 * Health check - verify duas are loaded
 */
router.get("/health", health);

export default router;
