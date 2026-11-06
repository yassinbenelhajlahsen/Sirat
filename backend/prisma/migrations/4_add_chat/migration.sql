-- CreateTable
CREATE TABLE "chat_usage" (
    "identity_hash" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "allowance" INTEGER NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_usage_pkey" PRIMARY KEY ("identity_hash","month")
);

-- CreateTable
CREATE TABLE "quran_ayahs" (
    "surah" INTEGER NOT NULL,
    "ayah" INTEGER NOT NULL,
    "text_ar" TEXT NOT NULL,
    "text_en" TEXT NOT NULL,

    CONSTRAINT "quran_ayahs_pkey" PRIMARY KEY ("surah","ayah")
);

-- CreateTable
CREATE TABLE "hadiths" (
    "id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "text_en" TEXT NOT NULL,
    "text_ar" TEXT,
    "grade" TEXT NOT NULL,
    "attribution" TEXT NOT NULL,
    "explanation" TEXT,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "hadiths_pkey" PRIMARY KEY ("id")
);

-- shortcut: sequential to_tsvector scan over ~9k rows, add a GIN expression index if search p95 > 100ms
