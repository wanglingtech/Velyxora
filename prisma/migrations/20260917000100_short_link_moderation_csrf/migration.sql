CREATE TYPE "ShortLinkStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "ShortLinkReportCategory" AS ENUM ('PHISHING', 'MALWARE', 'FRAUD', 'SPAM', 'IMPERSONATION', 'ILLEGAL_CONTENT', 'OTHER');
CREATE TYPE "ShortLinkReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

ALTER TABLE "Session" ADD COLUMN "csrfToken" TEXT;
ALTER TABLE "ShortLink" ADD COLUMN "status" "ShortLinkStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "disabledAt" TIMESTAMP(3),
ADD COLUMN "disabledReason" TEXT;

CREATE TABLE "ShortLinkReport" (
  "id" UUID NOT NULL,
  "shortLinkId" UUID NOT NULL,
  "reporterId" UUID,
  "category" "ShortLinkReportCategory" NOT NULL,
  "detail" TEXT,
  "status" "ShortLinkReportStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedBy" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShortLinkReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShortLink_status_createdAt_idx" ON "ShortLink"("status", "createdAt");
CREATE INDEX "ShortLinkReport_shortLinkId_status_idx" ON "ShortLinkReport"("shortLinkId", "status");
CREATE INDEX "ShortLinkReport_status_createdAt_idx" ON "ShortLinkReport"("status", "createdAt");
ALTER TABLE "ShortLinkReport" ADD CONSTRAINT "ShortLinkReport_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortLinkReport" ADD CONSTRAINT "ShortLinkReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
