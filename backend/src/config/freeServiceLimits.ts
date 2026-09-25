import { ENV } from './env';

// Centralized technical safeguards for the free service.
//
// These limits replace plan/credit-based runtime protection and are technical
// only: they protect infrastructure and are independent from plans, credits,
// payments and voluntary support. Donations never change any value here.
export const FREE_SERVICE_LIMITS = {
  /** Hard per-request upload ceiling, bounded by the infrastructure config. */
  maxUploadSizeBytes: ENV.MAX_UPLOAD_SIZE_BYTES,
  /** Maximum concurrent SERVER_REQUIRED jobs per account. */
  maxConcurrentServerJobs: 2,
  /** Maximum temporary files an account may hold before processing starts. */
  pendingFileLimit: 4,
  /** Administrative accounts still receive a bounded (not unlimited) concurrency. */
  adminMaxConcurrentServerJobs: 4,
} as const;
