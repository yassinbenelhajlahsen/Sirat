import cors from "cors";
import "dotenv/config";
import express from "express";
import { ENV } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { minVersionGate } from "./middleware/minVersionGate.js";
import appRoutes from "./routes/app.js";
import holidayRoutes from "./routes/holiday.js";
import mosqueRoutes from "./routes/mosque.js";
import prayerTimesRoutes from "./routes/prayerTimes.js";
import syncRoutes from "./routes/sync.js";
import accountRoutes from "./routes/account.js";
import feedbackRoutes from "./routes/feedback.js";
import reportRoutes from "./routes/report.js";

const app = express();

const resolveTrustProxy = (): boolean | number | string => {
  if (ENV.TRUST_PROXY) {
    if (ENV.TRUST_PROXY === "true") return true;
    if (ENV.TRUST_PROXY === "false") return false;
    const parsed = Number(ENV.TRUST_PROXY);
    return Number.isNaN(parsed) ? ENV.TRUST_PROXY : parsed;
  }
  return ENV.NODE_ENV === "production" ? 1 : false;
};

app.set("trust proxy", resolveTrustProxy());

// Middleware
// /api/sync and /api/feedback have their own larger parsers; skip the global 16KB parser for them.
const defaultJsonParser = express.json({ limit: "16kb" });
const OWN_PARSER_PREFIXES = ["/api/sync", "/api/feedback"];
app.use((req, res, next) => {
  if (OWN_PARSER_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return next();
  return defaultJsonParser(req, res, next);
});
app.use(
  cors({
    origin: [
      ENV.FRONTEND_URL,
      "http://localhost:8081",
      "http://localhost:19000",
      "http://localhost:8080",
      "exp://localhost:8081",
    ],
    credentials: true,
  }),
);

// Version gate: always blocks builds below MIN_SUPPORTED_APP_VERSION with 426.
app.use(minVersionGate);

// Routes
app.use("/api/app", appRoutes);
app.use("/api/mosque", mosqueRoutes);
app.use("/api/prayer-times", prayerTimesRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/reports", reportRoutes);

// Root health check
app.get("/", (req, res) => {
  res.json({
    name: "🕌 Sirat Backend",
    version: "1.0.0",
    status: "running",
    endpoints: {
      "GET /api/mosque/nearby": "Get nearby mosques by lat/lng",
      "GET /api/mosque/health": "Mosque service health check",
      "GET /api/prayer-times/timings":
        "Proxy current-day prayer timings by lat/lng/method (method supports integer or 'auto'; country optional)",
      "GET /api/prayer-times/calendar":
        "Proxy prayer calendar month by lat/lng/method/month/year (method supports integer or 'auto'; country optional)",
      "GET /api/prayer-times/calendar/year":
        "Proxy prayer calendar year by lat/lng/method/year (method supports integer or 'auto'; country optional)",
      "GET /api/prayer-times/health": "Prayer times service health check",
      "GET /api/app/version": "Proactive app version compatibility check",
      "GET /api/holidays/year": "Proxy holiday list for a Gregorian year",
      "GET /api/holidays/health": "Holiday service health check",
      "POST /api/feedback": "Submit feedback or a bug report (auth optional)",
      "POST /api/reports": "Report app output as wrong, e.g. a dua match (auth optional)",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = ENV.PORT;
app.listen(PORT, () => {
  console.log(`✅ Backend started at port: ${ENV.PORT}`);
});
