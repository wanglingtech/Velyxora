CREATE TYPE "YouTubeCircuitState" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

CREATE TABLE "ProviderCircuitBreaker" (
    "provider" TEXT NOT NULL,
    "state" "YouTubeCircuitState" NOT NULL DEFAULT 'CLOSED',
    "version" BIGINT NOT NULL DEFAULT 0,
    "nextOperationSequence" BIGINT NOT NULL DEFAULT 0,
    "lastAppliedOperationSequence" BIGINT NOT NULL DEFAULT 0,
    "lastSuccessOperationSequence" BIGINT NOT NULL DEFAULT 0,
    "consecutiveRestrictions" INTEGER NOT NULL DEFAULT 0,
    "restrictionWindowStartedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "cooldownLevel" INTEGER NOT NULL DEFAULT 0,
    "probeToken" UUID,
    "probeLeaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderCircuitBreaker_pkey" PRIMARY KEY ("provider")
);
