import { logger } from "../utils/logger";

export type YouTubeProviderHealthState = "HEALTHY" | "DEGRADED" | "RESTRICTED";
export type YouTubeProviderHealthReason = "bot_verification" | "technical_failure" | null;

export type YouTubeProviderHealthSnapshot = {
  state: YouTubeProviderHealthState;
  lastUpdatedAt: string;
  lastSuccessAt: string | null;
  lastRestrictionAt: string | null;
  lastFailureAt: string | null;
  reason: YouTubeProviderHealthReason;
};

type HealthChangeLogger = (event: string, fields: {
  from: YouTubeProviderHealthState;
  to: YouTubeProviderHealthState;
  reason: YouTubeProviderHealthReason;
  timestamp: string;
}) => void;

export class YouTubeProviderHealthService {
  private sequence = 0;
  private lastAppliedOperation = 0;
  private snapshot: YouTubeProviderHealthSnapshot;

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly logChange: HealthChangeLogger = (event, fields) => logger.info(event, fields),
  ) {
    this.snapshot = {
      state: "HEALTHY",
      lastUpdatedAt: this.now().toISOString(),
      lastSuccessAt: null,
      lastRestrictionAt: null,
      lastFailureAt: null,
      reason: null,
    };
  }

  beginOperation(): number {
    this.sequence += 1;
    return this.sequence;
  }

  recordSuccess(operationId: number): void {
    this.apply(operationId, "HEALTHY", null, "success");
  }

  recordRestriction(operationId: number): void {
    this.apply(operationId, "RESTRICTED", "bot_verification", "restriction");
  }

  recordTechnicalFailure(operationId: number): void {
    this.apply(operationId, "DEGRADED", "technical_failure", "failure");
  }

  recordError(operationId: number, errorCode: string): void {
    if (errorCode === "PROVIDER_TEMPORARILY_RESTRICTED") {
      this.recordRestriction(operationId);
    } else if (["YT_DLP_TIMEOUT", "YT_DLP_NOT_AVAILABLE", "EXTRACTOR_CHANGED"].includes(errorCode)) {
      this.recordTechnicalFailure(operationId);
    }
  }

  getSnapshot(): YouTubeProviderHealthSnapshot {
    return { ...this.snapshot };
  }

  private apply(
    operationId: number,
    state: YouTubeProviderHealthState,
    reason: YouTubeProviderHealthReason,
    outcome: "success" | "restriction" | "failure",
  ): void {
    if (!Number.isSafeInteger(operationId) || operationId <= this.lastAppliedOperation || operationId > this.sequence) return;
    const timestamp = this.now().toISOString();
    const previous = this.snapshot.state;
    this.lastAppliedOperation = operationId;
    this.snapshot = {
      ...this.snapshot,
      state,
      reason,
      lastUpdatedAt: timestamp,
      ...(outcome === "success" ? { lastSuccessAt: timestamp } : {}),
      ...(outcome === "restriction" ? { lastRestrictionAt: timestamp } : {}),
      ...(outcome === "failure" ? { lastFailureAt: timestamp } : {}),
    };
    if (previous !== state) {
      this.logChange("YOUTUBE_PROVIDER_HEALTH_CHANGED", { from: previous, to: state, reason, timestamp });
    }
  }
}

export const youtubeProviderHealthService = new YouTubeProviderHealthService();
