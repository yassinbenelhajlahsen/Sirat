import { Router } from "express";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { postReport } from "../controllers/reportController.js";

const router = Router();

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
});

router.use(clerkMiddleware());

/**
 * POST /api/reports
 * Body: { kind: "dua", input, output: { duaId } } or { kind: "chat", input, output: { answer, citationIds } }
 * Auth optional. Saved only, never emailed. Returns 201 { id }.
 */
router.post("/", reportLimiter, postReport);

export default router;
