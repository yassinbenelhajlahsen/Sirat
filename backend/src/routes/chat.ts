import express, { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import {
  DEV_USER_ID,
  chatBodyErrors,
  getChatStatus,
  isDevChatRequest,
  postChat,
  requireChatEnabled,
  validateChat,
} from "../controllers/chatController.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";

const router = Router();

// Dev requests skip sign-in and take the fixed dev id, which also keys the per-user limit.
function requireChatUser(req: Request, res: Response, next: NextFunction) {
  if (!isDevChatRequest(req)) return requireAuth(req, res, next);
  (req as AuthedRequest).userId = DEV_USER_ID;
  return next();
}

// Catches scripts spread across accounts.
const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again later." },
});

// Stops scripts and bugs; the monthly count is what caps cost.
const userLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req as AuthedRequest).userId!,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many messages, please wait a minute." },
});

router.use(ipLimiter);
// History plus summary can pass the global 16KB limit.
router.use(express.json({ limit: "128kb" }));
router.use(chatBodyErrors);
router.use(clerkMiddleware());

/**
 * GET /api/chat/status
 * Auth optional. 200 { enabled, allowance, remaining, resetsAt }; quota fields are null when signed out.
 */
router.get("/status", requireChatEnabled, getChatStatus);

/**
 * POST /api/chat
 * Body: { message, history, summary, deviceToken }. Auth required.
 * Order: switch, auth, validation, per-user limit, then quota claim before any OpenAI call.
 */
router.post("/", requireChatEnabled, requireChatUser, validateChat, userLimiter, postChat);

export default router;
