-- CreateTable
CREATE TABLE "feedback_reports" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "user_id" TEXT,
    "app_version" TEXT,
    "platform" TEXT,
    "device" TEXT,
    "diagnostics" JSONB,

    CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_reports_user_id_idx" ON "feedback_reports"("user_id");

