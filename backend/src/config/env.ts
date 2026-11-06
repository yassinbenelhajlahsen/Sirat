export const ENV = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || "development",
  TRUST_PROXY: process.env.TRUST_PROXY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-6.1-terra",
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:8081",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  MIN_SUPPORTED_APP_VERSION: process.env.MIN_SUPPORTED_APP_VERSION || "1.0.0",
  DATABASE_URL: process.env.DATABASE_URL || "",
  SHADOW_DATABASE_URL: process.env.SHADOW_DATABASE_URL || "",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
  RESEND_API_KEY: process.env.RESEND_API_KEY || "",
  RESEND_CONTACTS_API_KEY: process.env.RESEND_CONTACTS_API_KEY || "",
  RESEND_SEGMENT_ID: process.env.RESEND_SEGMENT_ID || "",
} as const;

if (!ENV.GOOGLE_MAPS_API_KEY) {
  console.warn("⚠️  GOOGLE_MAPS_API_KEY is not set. Mosque search will fail.");
}

if (!ENV.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL is not set. Account & sync endpoints will fail.");
}

if (!ENV.CLERK_SECRET_KEY) {
  console.warn("⚠️  CLERK_SECRET_KEY is not set. Auth verification will fail.");
}

if (!ENV.RESEND_API_KEY) {
  console.warn("⚠️  RESEND_API_KEY is not set. Feedback emails will not be sent.");
}

if (!ENV.RESEND_CONTACTS_API_KEY || !ENV.RESEND_SEGMENT_ID) {
  console.warn("⚠️  RESEND_CONTACTS_API_KEY or RESEND_SEGMENT_ID is not set. New users will not join the mailing list.");
}
