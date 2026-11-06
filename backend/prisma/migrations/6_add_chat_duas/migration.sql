-- CreateTable
CREATE TABLE "duas" (
    "id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "arabic" TEXT NOT NULL,
    "english" TEXT NOT NULL,
    "transliteration" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "duas_pkey" PRIMARY KEY ("id")
);
