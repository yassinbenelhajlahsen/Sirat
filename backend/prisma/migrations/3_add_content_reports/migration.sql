-- CreateTable
CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" JSONB NOT NULL,
    "user_id" TEXT,
    "app_version" TEXT,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_reports_kind_created_at_idx" ON "content_reports"("kind", "created_at");

-- CreateIndex
CREATE INDEX "content_reports_user_id_idx" ON "content_reports"("user_id");
