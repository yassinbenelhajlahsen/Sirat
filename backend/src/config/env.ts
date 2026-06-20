export const ENV = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || "development",
  TRUST_PROXY: process.env.TRUST_PROXY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4-turbo",
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:8081",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  MIN_SUPPORTED_APP_VERSION: process.env.MIN_SUPPORTED_APP_VERSION || "1.0.0",
  ENFORCE_MIN_VERSION: process.env.ENFORCE_MIN_VERSION || "false",
  DATABASE_URL: process.env.DATABASE_URL || "",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
} as const;

if (!ENV.GOOGLE_MAPS_API_KEY) {
  console.warn("⚠️  GOOGLE_MAPS_API_KEY is not set. Mosque search will fail.");
}

if (!ENV.OPENAI_API_KEY) {
  console.warn(
    "⚠️  OPENAI_API_KEY is not set. Dua selection will use random fallback.",
  );
}

if (!ENV.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL is not set. Account & sync endpoints will fail.");
}

if (!ENV.CLERK_SECRET_KEY) {
  console.warn("⚠️  CLERK_SECRET_KEY is not set. Auth verification will fail.");
}
