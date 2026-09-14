ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'BANNED';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'ANONYMIZED';

CREATE TYPE "ComplaintType" AS ENUM ('RECLAMO', 'QUEJA');
CREATE TYPE "ComplaintStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'RESPONDED', 'CLOSED');
CREATE TYPE "SuggestionCategory" AS ENUM ('MEJORA', 'NUEVA_FUNCION', 'PROBLEMA_UX', 'OTRO');
CREATE TYPE "SuggestionStatus" AS ENUM ('SUBMITTED', 'REVIEWING', 'PLANNED', 'DECLINED', 'COMPLETED');

CREATE TABLE "DeniedIdentity" ("id" UUID NOT NULL, "emailHash" TEXT NOT NULL, "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "adminId" UUID NOT NULL, CONSTRAINT "DeniedIdentity_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "DeniedIdentity_emailHash_key" ON "DeniedIdentity"("emailHash");
CREATE INDEX "DeniedIdentity_createdAt_idx" ON "DeniedIdentity"("createdAt");

CREATE TABLE "Complaint" ("id" UUID NOT NULL, "trackingCode" TEXT NOT NULL, "userId" UUID, "claimantName" TEXT NOT NULL, "email" TEXT NOT NULL, "type" "ComplaintType" NOT NULL, "subject" TEXT NOT NULL, "detail" TEXT NOT NULL, "status" "ComplaintStatus" NOT NULL DEFAULT 'RECEIVED', "flagged" BOOLEAN NOT NULL DEFAULT false, "adminResponse" TEXT, "respondedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "Complaint_trackingCode_key" ON "Complaint"("trackingCode");
CREATE INDEX "Complaint_userId_createdAt_idx" ON "Complaint"("userId", "createdAt");
CREATE INDEX "Complaint_status_createdAt_idx" ON "Complaint"("status", "createdAt");
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Suggestion" ("id" UUID NOT NULL, "userId" UUID NOT NULL, "category" "SuggestionCategory" NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "status" "SuggestionStatus" NOT NULL DEFAULT 'SUBMITTED', "adminResponse" TEXT, "reaction" TEXT, "respondedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id"));
CREATE INDEX "Suggestion_userId_createdAt_idx" ON "Suggestion"("userId", "createdAt");
CREATE INDEX "Suggestion_status_createdAt_idx" ON "Suggestion"("status", "createdAt");
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
