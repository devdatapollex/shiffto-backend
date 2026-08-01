/*
  Warnings:

  - A unique constraint covering the columns `[shipmentId]` on the table `offers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PENDING_REFUND';

-- DropIndex
DROP INDEX "unique_active_or_pending_offer_per_shipment";

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "adminRefundNotes" TEXT,
ADD COLUMN     "refundMethodDetails" JSONB,
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundTxnId" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "refundedBy" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "unique_active_or_pending_offer_per_shipment" ON "offers"("shipmentId") WHERE (status IN ('PAYMENT_PENDING', 'ACCEPTED'));
