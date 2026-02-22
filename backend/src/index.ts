import cors from "cors";
import "dotenv/config";
import express from "express";
import { ENV } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import duaRoutes from "./routes/dua.js";
import mosqueRoutes from "./routes/mosque.js";
import prayerTimesRoutes from "./routes/prayerTimes.js";

const app = express();

// Middleware
app.use(express.json());
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

// Routes
app.use("/api/dua", duaRoutes);
app.use("/api/mosque", mosqueRoutes);
app.use("/api/prayer-times", prayerTimesRoutes);

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
        "Proxy current-day prayer timings by lat/lng/method",
      "GET /api/prayer-times/calendar":
        "Proxy prayer calendar month by lat/lng/method/month/year",
      "GET /api/prayer-times/health": "Prayer times service health check",
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
