import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ENV } from "../config/env";
import { prisma } from "../db/prisma";
import { logger } from "../utils/logger";

export type YouTubeCircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
export type YouTubeCircuitRejectReason = "cooldown_active" | "probe_in_progress" | "breaker_store_unavailable";

export type YouTubeCircuitPermit = {
  operationSequence: bigint;
  state: "CLOSED" | "HALF_OPEN";
  probeToken: string | null;
};

type CircuitRow = {
  state: YouTubeCircuitState;
  operationSequence: bigint;
  probeToken: string | null;
  cooldownLevel: number;
};

type EventFields = {
  from?: YouTubeCircuitState;
  to?: YouTubeCircuitState;
  reason: string;
  cooldownLevel?: number;
  cooldownSeconds?: number;
  leaseSeconds?: number;
  timestamp: string;
};

export class YouTubeCircuitBreakerRejectedError extends Error {
  constructor(readonly reason: YouTubeCircuitRejectReason) {
    super(reason);
    this.name = "YouTubeCircuitBreakerRejectedError";
  }
}

const PROVIDER = "youtube";
const THRESHOLD = 3;
const WINDOW_MINUTES = 10;
const COOLDOWN_SECONDS = [15 * 60, 30 * 60, 60 * 60, 120 * 60] as const;
// yt-dlp defaults to 10 minutes. The extra two minutes cover the 3-second
// sidecar preflight, scheduling jitter and result persistence without making
// a crashed probe lease permanent.
export const YOUTUBE_CIRCUIT_PROBE_LEASE_MS = Math.max(12 * 60 * 1000, ENV.YT_DLP_TIMEOUT_MS + 2 * 60 * 1000);

export class YouTubeCircuitBreakerService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly emit: (event: string, fields: EventFields) => void = (event, fields) => logger.info(event, fields),
  ) {}

  async acquire(): Promise<YouTubeCircuitPermit> {
    try {
      const result = await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`
          INSERT INTO "ProviderCircuitBreaker" ("provider", "updatedAt")
          VALUES (${PROVIDER}, CURRENT_TIMESTAMP)
          ON CONFLICT ("provider") DO NOTHING
        `;

        const closed = await tx.$queryRaw<CircuitRow[]>`
          UPDATE "ProviderCircuitBreaker"
          SET "nextOperationSequence" = "nextOperationSequence" + 1,
              "version" = "version" + 1,
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "provider" = ${PROVIDER} AND "state" = 'CLOSED'
          RETURNING "state", "nextOperationSequence" AS "operationSequence", NULL::uuid::text AS "probeToken", "cooldownLevel"
        `;
        if (closed[0]) return { row: closed[0], expired: false };

        const token = randomUUID();
        const leaseSeconds = Math.ceil(YOUTUBE_CIRCUIT_PROBE_LEASE_MS / 1000);
        const probe = await tx.$queryRaw<CircuitRow[]>`
          UPDATE "ProviderCircuitBreaker"
          SET "state" = 'HALF_OPEN',
              "nextOperationSequence" = "nextOperationSequence" + 1,
              "version" = "version" + 1,
              "probeToken" = ${token}::uuid,
              "probeLeaseUntil" = CURRENT_TIMESTAMP + (${leaseSeconds} * INTERVAL '1 second'),
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "provider" = ${PROVIDER} AND "state" = 'OPEN'
            AND "cooldownUntil" <= CURRENT_TIMESTAMP
          RETURNING "state", "nextOperationSequence" AS "operationSequence", "probeToken"::text, "cooldownLevel"
        `;
        if (probe[0]) return { row: probe[0], expired: false };

        const replacementToken = randomUUID();
        const expiredProbe = await tx.$queryRaw<CircuitRow[]>`
          UPDATE "ProviderCircuitBreaker"
          SET "nextOperationSequence" = "nextOperationSequence" + 1,
              "version" = "version" + 1,
              "probeToken" = ${replacementToken}::uuid,
              "probeLeaseUntil" = CURRENT_TIMESTAMP + (${leaseSeconds} * INTERVAL '1 second'),
              "updatedAt" = CURRENT_TIMESTAMP
          WHERE "provider" = ${PROVIDER} AND "state" = 'HALF_OPEN'
            AND "probeLeaseUntil" <= CURRENT_TIMESTAMP
          RETURNING "state", "nextOperationSequence" AS "operationSequence", "probeToken"::text, "cooldownLevel"
        `;
        if (expiredProbe[0]) return { row: expiredProbe[0], expired: true };

        const current = await tx.$queryRaw<Array<{ state: YouTubeCircuitState }>>`
          SELECT "state" FROM "ProviderCircuitBreaker" WHERE "provider" = ${PROVIDER}
        `;
        throw new YouTubeCircuitBreakerRejectedError(current[0]?.state === "HALF_OPEN" ? "probe_in_progress" : "cooldown_active");
      });

      const permit: YouTubeCircuitPermit = {
        operationSequence: result.row.operationSequence,
        state: result.row.state as "CLOSED" | "HALF_OPEN",
        probeToken: result.row.probeToken,
      };
      if (permit.state === "HALF_OPEN") {
        const timestamp = new Date().toISOString();
        if (result.expired) this.emit("YOUTUBE_CIRCUIT_PROBE_EXPIRED", { reason: "lease_expired", timestamp });
        if (!result.expired) this.emit("YOUTUBE_CIRCUIT_HALF_OPEN", { from: "OPEN", to: "HALF_OPEN", reason: "cooldown_elapsed", timestamp });
        this.emit("YOUTUBE_CIRCUIT_PROBE_ACQUIRED", { reason: "lease_acquired", leaseSeconds: Math.ceil(YOUTUBE_CIRCUIT_PROBE_LEASE_MS / 1000), timestamp });
      }
      return permit;
    } catch (error) {
      if (error instanceof YouTubeCircuitBreakerRejectedError) throw error;
      throw new YouTubeCircuitBreakerRejectedError("breaker_store_unavailable");
    }
  }

  async recordSuccess(permit: YouTubeCircuitPermit): Promise<void> {
    if (permit.state === "HALF_OPEN") {
      const changed = await this.db.$queryRaw<Array<{ cooldownLevel: number }>>`
        UPDATE "ProviderCircuitBreaker"
        SET "state" = 'CLOSED', "version" = "version" + 1,
            "lastAppliedOperationSequence" = ${permit.operationSequence},
            "lastSuccessOperationSequence" = ${permit.operationSequence},
            "consecutiveRestrictions" = 0, "restrictionWindowStartedAt" = NULL,
            "openedAt" = NULL, "cooldownUntil" = NULL, "cooldownLevel" = 0,
            "probeToken" = NULL, "probeLeaseUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "provider" = ${PROVIDER} AND "state" = 'HALF_OPEN'
          AND "probeToken" = ${permit.probeToken}::uuid
        RETURNING "cooldownLevel"
      `;
      if (changed.length) this.emit("YOUTUBE_CIRCUIT_CLOSED", { from: "HALF_OPEN", to: "CLOSED", reason: "probe_success", cooldownLevel: 0, timestamp: new Date().toISOString() });
      return;
    }
    await this.db.$executeRaw`
      UPDATE "ProviderCircuitBreaker"
      SET "lastAppliedOperationSequence" = ${permit.operationSequence},
          "lastSuccessOperationSequence" = ${permit.operationSequence},
          "consecutiveRestrictions" = 0, "restrictionWindowStartedAt" = NULL,
          "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "provider" = ${PROVIDER} AND "state" = 'CLOSED'
        AND "lastAppliedOperationSequence" < ${permit.operationSequence}
    `;
  }

  async recordRestriction(permit: YouTubeCircuitPermit): Promise<void> {
    if (permit.state === "HALF_OPEN") {
      const rows = await this.db.$queryRaw<Array<{ cooldownLevel: number }>>`
        UPDATE "ProviderCircuitBreaker"
        SET "state" = 'OPEN', "version" = "version" + 1,
            "lastAppliedOperationSequence" = ${permit.operationSequence},
            "consecutiveRestrictions" = ${THRESHOLD},
            "openedAt" = CURRENT_TIMESTAMP,
            "cooldownLevel" = LEAST("cooldownLevel" + 1, 3),
            "cooldownUntil" = CURRENT_TIMESTAMP + (
              CASE "cooldownLevel" WHEN 0 THEN 1800 WHEN 1 THEN 3600 ELSE 7200 END * INTERVAL '1 second'
            ),
            "probeToken" = NULL, "probeLeaseUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
        WHERE "provider" = ${PROVIDER} AND "state" = 'HALF_OPEN'
          AND "probeToken" = ${permit.probeToken}::uuid
        RETURNING "cooldownLevel"
      `;
      if (rows[0]) this.emit("YOUTUBE_CIRCUIT_OPENED", { from: "HALF_OPEN", to: "OPEN", reason: "probe_restricted", cooldownLevel: rows[0].cooldownLevel, cooldownSeconds: COOLDOWN_SECONDS[rows[0].cooldownLevel], timestamp: new Date().toISOString() });
      return;
    }

    const rows = await this.db.$queryRaw<Array<{ state: YouTubeCircuitState; cooldownLevel: number }>>`
      UPDATE "ProviderCircuitBreaker"
      SET "lastAppliedOperationSequence" = GREATEST("lastAppliedOperationSequence", ${permit.operationSequence}),
          "consecutiveRestrictions" = CASE
            WHEN "restrictionWindowStartedAt" IS NULL OR "restrictionWindowStartedAt" < CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute') THEN 1
            ELSE "consecutiveRestrictions" + 1 END,
          "restrictionWindowStartedAt" = CASE
            WHEN "restrictionWindowStartedAt" IS NULL OR "restrictionWindowStartedAt" < CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute') THEN CURRENT_TIMESTAMP
            ELSE "restrictionWindowStartedAt" END,
          "state" = CASE WHEN (CASE
            WHEN "restrictionWindowStartedAt" IS NULL OR "restrictionWindowStartedAt" < CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute') THEN 1
            ELSE "consecutiveRestrictions" + 1 END) >= ${THRESHOLD} THEN 'OPEN'::"YouTubeCircuitState" ELSE "state" END,
          "openedAt" = CASE WHEN (CASE
            WHEN "restrictionWindowStartedAt" IS NULL OR "restrictionWindowStartedAt" < CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute') THEN 1
            ELSE "consecutiveRestrictions" + 1 END) >= ${THRESHOLD} THEN CURRENT_TIMESTAMP ELSE "openedAt" END,
          "cooldownUntil" = CASE WHEN (CASE
            WHEN "restrictionWindowStartedAt" IS NULL OR "restrictionWindowStartedAt" < CURRENT_TIMESTAMP - (${WINDOW_MINUTES} * INTERVAL '1 minute') THEN 1
            ELSE "consecutiveRestrictions" + 1 END) >= ${THRESHOLD} THEN CURRENT_TIMESTAMP + (900 * INTERVAL '1 second') ELSE "cooldownUntil" END,
          "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "provider" = ${PROVIDER} AND "state" = 'CLOSED'
        AND "lastSuccessOperationSequence" < ${permit.operationSequence}
      RETURNING "state", "cooldownLevel"
    `;
    if (rows[0]?.state === "OPEN") this.emit("YOUTUBE_CIRCUIT_OPENED", { from: "CLOSED", to: "OPEN", reason: "restriction_threshold", cooldownLevel: rows[0].cooldownLevel, cooldownSeconds: 900, timestamp: new Date().toISOString() });
  }

  async recordNeutral(permit: YouTubeCircuitPermit): Promise<void> {
    if (permit.state !== "CLOSED") return;
    await this.db.$executeRaw`
      UPDATE "ProviderCircuitBreaker"
      SET "lastAppliedOperationSequence" = ${permit.operationSequence}, "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "provider" = ${PROVIDER} AND "state" = 'CLOSED'
        AND "lastAppliedOperationSequence" < ${permit.operationSequence}
    `;
  }
}

export const youtubeCircuitBreakerService = new YouTubeCircuitBreakerService();
