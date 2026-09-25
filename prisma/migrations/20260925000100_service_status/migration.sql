CREATE TYPE "ServiceStatusState" AS ENUM ('OPERATIONAL', 'LIMITED', 'MAINTENANCE', 'UNAVAILABLE');

CREATE TABLE "ServiceStatus" (
    "id" UUID NOT NULL,
    "singleton" TEXT NOT NULL DEFAULT 'current',
    "state" "ServiceStatusState" NOT NULL,
    "message" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,
    CONSTRAINT "ServiceStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceStatus_singleton_key" ON "ServiceStatus"("singleton");
