-- AlterTable PaymentTransaction: add commission fields
ALTER TABLE "payment_transactions" 
ADD COLUMN "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
ADD COLUMN "commissionAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN "netAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- Backfill PaymentTransaction commission fields for existing rows
UPDATE "payment_transactions" 
SET "commissionRate" = 0.3, 
    "commissionAmount" = "grossAmount" * 0.3, 
    "netAmount" = "grossAmount" - ("grossAmount" * 0.3);

-- AlterTable WithdrawalRequest: add amount column
ALTER TABLE "withdrawal_requests" 
ADD COLUMN "amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- Backfill WithdrawalRequest amount column from existing netAmount
UPDATE "withdrawal_requests" 
SET "amount" = "netAmount";

-- Drop old columns on WithdrawalRequest
ALTER TABLE "withdrawal_requests" 
DROP COLUMN "grossAmount",
DROP COLUMN "commissionRate",
DROP COLUMN "commissionAmount",
DROP COLUMN "netAmount";
