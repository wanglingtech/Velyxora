-- DESTRUCTIVE MIGRATION — LEGACY COMMERCIAL SCHEMA RETIREMENT
--
-- WARNING: Applying this migration PERMANENTLY DELETES the legacy commercial
-- tables and every row they contain, and drops the obsolete credit-denominated
-- columns from ProcessingHistory and ProcessingUsage. This data cannot be
-- recovered from the application after the migration is applied. Archive or
-- back up legacy commercial data before applying this migration.
--
-- This migration is intentionally separate from (and ordered after) the additive
-- ServiceStatus migration `20260925000100_service_status`. ServiceStatus is not
-- part of the commercial model and is not touched here.
--
-- Drop order is derived from the actual foreign keys:
--   CreditLedger.paymentId  -> Payment
--   Payment.orderId         -> PaymentOrder
--   PaymentOrder.planId     -> Plan
--   UserPlan.planId         -> Plan
-- so tables are dropped CreditLedger -> Payment -> PaymentOrder -> UserPlan -> Plan,
-- and the obsolete enums are dropped only after no table/column depends on them.

-- 1. Drop obsolete credit-denominated columns.
--    These values are permanently lost. ProcessingUsage itself is retained as
--    technical resource/fair-use accounting.
ALTER TABLE "ProcessingHistory" DROP COLUMN "creditsCost";
ALTER TABLE "ProcessingUsage" DROP COLUMN "estimatedCredits";
ALTER TABLE "ProcessingUsage" DROP COLUMN "reservedCredits";
ALTER TABLE "ProcessingUsage" DROP COLUMN "consumedCredits";

-- 2. Drop legacy commercial tables in foreign-key-safe order.
--    All rows in these tables are permanently deleted.
DROP TABLE "CreditLedger";
DROP TABLE "Payment";
DROP TABLE "PaymentOrder";
DROP TABLE "UserPlan";
DROP TABLE "Plan";

-- 3. Drop obsolete enums now that no column depends on them.
DROP TYPE "LedgerType";
DROP TYPE "PaymentStatus";
DROP TYPE "PaymentOrderStatus";
DROP TYPE "PlanCode";
