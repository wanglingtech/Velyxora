ALTER TYPE "PaymentOrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED_BY_USER';
ALTER TABLE "Complaint"
  ADD COLUMN "sequenceNumber" SERIAL NOT NULL,
  ADD COLUMN "documentId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "phone" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "representativeName" TEXT,
  ADD COLUMN "representativeDocument" TEXT,
  ADD COLUMN "serviceDescription" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "amountMinor" INTEGER,
  ADD COLUMN "consumerRequest" TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX "Complaint_sequenceNumber_key" ON "Complaint"("sequenceNumber");
