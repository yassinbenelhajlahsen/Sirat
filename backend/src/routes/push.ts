import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { postRegister, postUnregister, pushBodyErrors } from "../controllers/pushController.js";

const router = Router();

// 100 because carrier NAT puts many phones behind one IP.
const pushLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again later." },
});

// Anonymous: no clerkMiddleware, any Authorization header is ignored.
router.use(pushLimiter);
router.use(express.json({ limit: "1kb" }));
router.use(pushBodyErrors);

/**
 * POST /api/push/register
 * Body: { token } (an Expo push token). Saves it, or refreshes lastSeenAt and appVersion. Returns 200 { ok: true }.
 */
router.post("/register", postRegister);

/**
 * POST /api/push/unregister
 * Body: { token }. Deletes it; a missing token is not an error. Returns 200 { ok: true }.
 */
router.post("/unregister", postUnregister);

export default router;
