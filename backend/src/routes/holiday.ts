import express from "express";
import rateLimit from "express-rate-limit";
import { getHolidaysByYearHandler } from "../controllers/holidayController.js";

const router = express.Router();

const holidayLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests from this IP, please try again later.",
      retriable: true,
    },
  },
});

router.get("/year", holidayLimiter, getHolidaysByYearHandler);

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "holidays",
    timestamp: new Date().toISOString(),
  });
});

export default router;
