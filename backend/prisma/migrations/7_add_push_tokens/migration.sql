-- CreateTable
CREATE TABLE "push_tokens" (
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "app_version" TEXT,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("token")
);
