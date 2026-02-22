import express from "express";
import rateLimit from "express-rate-limit";
import {
  getCalendarHandler,
  getTimingsHandler,
} from "../controllers/prayerTimesController.js";

const router = express.Router();

const RATE_LIMIT_RESPONSE = {
  error: {
    code: "RATE_LIMITED",
    message: "Too many requests from this IP, please try again later.",
    retriable: true,
  },
};

function logPrayerTimesRateLimit(req: express.Request) {
  console.warn(
    JSON.stringify({
      event: "prayer_times_rate_limited",
      service: "prayer-times",
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
    }),
  );
}

const prayerTimesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: RATE_LIMIT_RESPONSE,
  handler: (req, res, _next, options) => {
    logPrayerTimesRateLimit(req);
    res.status(options.statusCode).json(RATE_LIMIT_RESPONSE);
  },
});

router.get("/timings", prayerTimesLimiter, getTimingsHandler);
router.get("/calendar", prayerTimesLimiter, getCalendarHandler);

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "prayer-times",
    timestamp: new Date().toISOString(),
  });
});

export default router;
