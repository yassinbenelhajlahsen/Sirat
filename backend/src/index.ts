import cors from "cors";
import "dotenv/config";
import express from "express";
import { ENV } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { minVersionGate } from "./middleware/minVersionGate.js";
import appRoutes from "./routes/app.js";
import duaRoutes from "./routes/dua.js";
import holidayRoutes from "./routes/holiday.js";
import mosqueRoutes from "./routes/mosque.js";
import prayerTimesRoutes from "./routes/prayerTimes.js";
import syncRoutes from "./routes/sync.js";
import accountRoutes from "./routes/account.js";

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
// /api/sync has its own 1MB parser on the router; skip the global 16KB parser for those paths.
const defaultJsonParser = express.json({ limit: "16kb" });
app.use((req, res, next) => {
  if (req.path === "/api/sync" || req.path.startsWith("/api/sync/")) return next();
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

// Version gate middleware (monitor mode by default, enforcement via ENFORCE_MIN_VERSION=true)
app.use(minVersionGate);

// Routes
app.use("/api/app", appRoutes);
app.use("/api/dua", duaRoutes);
app.use("/api/mosque", mosqueRoutes);
app.use("/api/prayer-times", prayerTimesRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/account", accountRoutes);

// Root health check
app.get("/", (req, res) => {
  res.json({
    name: "🕌 Sirat Backend",
    version: "1.0.0",
    status: "running",
    endpoints: {
      "POST /api/dua": "Match user request to a dua",
      "GET /api/dua/health": "Health check",
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
