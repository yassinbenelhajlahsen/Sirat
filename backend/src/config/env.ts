export const ENV = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || "development",
  TRUST_PROXY: process.env.TRUST_PROXY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-6-luna",
  OPENAI_MODERATION_MODEL: process.env.OPENAI_MODERATION_MODEL || "omni-moderation-latest",
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
  CHAT_ENABLED: process.env.CHAT_ENABLED === "1",
  CHAT_DEV_BYPASS: process.env.CHAT_DEV_BYPASS === "1",
  CHAT_IDENTITY_SECRET: process.env.CHAT_IDENTITY_SECRET || "",
  CHAT_QURAN_QUOTES: (process.env.CHAT_QURAN_QUOTES === "reference" ? "reference" : "text") as "text" | "reference",
  CHAT_SCHOLAR_LINK: process.env.CHAT_SCHOLAR_LINK || "https://seekersguidance.org/answers/",
  DEVICECHECK_TEAM_ID: process.env.DEVICECHECK_TEAM_ID || "",
  DEVICECHECK_KEY_ID: process.env.DEVICECHECK_KEY_ID || "",
  // Railway stores the PEM on one line with literal \n escapes.
  DEVICECHECK_PRIVATE_KEY: (process.env.DEVICECHECK_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  DEVICECHECK_ENV: (process.env.DEVICECHECK_ENV === "development" ? "development" : "production") as "production" | "development",
  DEVICECHECK_REQUIRED: process.env.DEVICECHECK_REQUIRED !== "0",
} as const;

// Refusing to start, not just ignoring the flag, so a production deploy with it set is noticed at once.
if (ENV.CHAT_DEV_BYPASS) {
  if (ENV.NODE_ENV === "production") throw new Error("CHAT_DEV_BYPASS is not allowed in production");
  console.warn("⚠️  CHAT_DEV_BYPASS is on. Chat skips sign-in and the monthly limit for requests with x-sirat-chat-dev: 1.");
}

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

if (ENV.CHAT_ENABLED) {
  const missing = [
    ["OPENAI_API_KEY", ENV.OPENAI_API_KEY],
    ["CHAT_IDENTITY_SECRET", ENV.CHAT_IDENTITY_SECRET],
    ...(ENV.DEVICECHECK_REQUIRED
      ? [
          ["DEVICECHECK_TEAM_ID", ENV.DEVICECHECK_TEAM_ID],
          ["DEVICECHECK_KEY_ID", ENV.DEVICECHECK_KEY_ID],
          ["DEVICECHECK_PRIVATE_KEY", ENV.DEVICECHECK_PRIVATE_KEY],
        ]
      : []),
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    console.warn(`⚠️  CHAT_ENABLED is on but ${missing.join(", ")} is not set. Chat will fail.`);
  }
}
