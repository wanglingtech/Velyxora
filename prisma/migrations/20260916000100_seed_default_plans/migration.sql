-- The application requires these plans for registration and credit accounting.
-- Stable IDs keep this data migration deterministic across clean deployments.
INSERT INTO "Plan" (
  "id", "code", "monthlyCredits", "maxUploadSize", "maxConcurrentJobs",
  "priority", "historyRetention", "active", "createdAt", "updatedAt"
)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'FREE', 25, 26214400, 1, 0, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000002', 'PLUS', 300, 104857600, 2, 1, 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000003', 'PRO', 1200, 524288000, 4, 2, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "monthlyCredits" = EXCLUDED."monthlyCredits",
  "maxUploadSize" = EXCLUDED."maxUploadSize",
  "maxConcurrentJobs" = EXCLUDED."maxConcurrentJobs",
  "priority" = EXCLUDED."priority",
  "historyRetention" = EXCLUDED."historyRetention",
  "active" = EXCLUDED."active",
  "updatedAt" = CURRENT_TIMESTAMP;
