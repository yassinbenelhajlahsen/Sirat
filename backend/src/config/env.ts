export const ENV = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || "development",
  TRUST_PROXY: process.env.TRUST_PROXY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4-turbo",
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:8081",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
} as const;

if (!ENV.GOOGLE_MAPS_API_KEY) {
  console.warn("⚠️  GOOGLE_MAPS_API_KEY is not set. Mosque search will fail.");
}

if (!ENV.OPENAI_API_KEY) {
  console.warn(
    "⚠️  OPENAI_API_KEY is not set. Dua selection will use random fallback.",
  );
}
