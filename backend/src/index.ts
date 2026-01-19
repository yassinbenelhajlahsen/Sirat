import cors from "cors";
import "dotenv/config";
import express from "express";
import { ENV } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import duaRoutes from "./routes/dua.js";

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

// Root health check
app.get("/", (req, res) => {
  res.json({
    name: "🕌 Sirat Backend",
    version: "1.0.0",
    status: "running",
    endpoints: {
      "POST /api/dua": "Match user request to a dua",
      "GET /api/dua/health": "Health check",
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
