import { Router } from "express";
import { health, matchDua } from "../controllers/duaController.js";

const router = Router();

/**
 * POST /api/dua/match
 * Match user request to a dua
 * Body: { userRequest: string }
 * Response: { dua: Dua }
 */
router.post("/match", matchDua);

/**
 * GET /api/dua/health
 * Health check - verify duas are loaded
 */
router.get("/health", health);

export default router;
