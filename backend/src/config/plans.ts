export const PLAN_CONFIG = {
  FREE: { monthlyCredits: 25, maxUploadSize: 25 * 1024 * 1024, maxConcurrentJobs: 1, priority: 0, historyRetention: 30 },
  PLUS: { monthlyCredits: 300, maxUploadSize: 100 * 1024 * 1024, maxConcurrentJobs: 2, priority: 1, historyRetention: 90 },
  PRO: { monthlyCredits: 1200, maxUploadSize: 500 * 1024 * 1024, maxConcurrentJobs: 4, priority: 2, historyRetention: null },
} as const;

export type PlanCode = keyof typeof PLAN_CONFIG;
