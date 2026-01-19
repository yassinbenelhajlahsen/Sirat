import { Router } from "express";
import { health, matchDua } from "../controllers/duaController.js";

const router = Router();

/**
 * POST /api/dua
 * Match user request to a dua
 * Body: { userRequest: string }
 * Response: { dua: Dua, matchSource: "regex" | "ai" | "fallback" }
 */
router.post("/", matchDua);

/**
 * GET /api/dua/health
 * Health check - verify duas are loaded
 */
router.get("/health", health);

export default router;
