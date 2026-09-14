CREATE TYPE "HistoryStatus" AS ENUM ('COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "ProcessingType" AS ENUM ('LOCAL', 'SERVER', 'EXTERNAL');

CREATE TABLE "ProcessingHistory" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "toolId" TEXT NOT NULL,
  "status" "HistoryStatus" NOT NULL,
  "processingType" "ProcessingType" NOT NULL,
  "inputFileName" TEXT,
  "inputSize" BIGINT,
  "inputMime" TEXT,
  "outputFileName" TEXT,
  "outputSize" BIGINT,
  "creditsCost" INTEGER,
  "jobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcessingHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcessingHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProcessingHistory_userId_jobId_key" ON "ProcessingHistory"("userId", "jobId");
CREATE INDEX "ProcessingHistory_userId_createdAt_idx" ON "ProcessingHistory"("userId", "createdAt");
