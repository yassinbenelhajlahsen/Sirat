import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { postFeedback } from "../controllers/feedbackController.js";

const router = Router();

const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
});

// Bug reports carry a diagnostics log; allow more than the global 16KB limit.
router.use(express.json({ limit: "256kb" }));
router.use(clerkMiddleware());

/**
 * POST /api/feedback
 * Body: { type: "feedback" | "bug", message, email?, diagnostics? }
 * Auth optional. Returns 201 { id }.
 */
router.post("/", feedbackLimiter, postFeedback);

export default router;
