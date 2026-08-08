/*
  Warnings:

  - A unique constraint covering the columns `[shipmentId]` on the table `offers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RefundInitiator" AS ENUM ('SENDER', 'TRAVELLER', 'ADMIN');

-- DropIndex
DROP INDEX "unique_active_or_pending_offer_per_shipment";

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN     "cancellationFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "refundInitiator" "RefundInitiator",
ADD COLUMN     "refundableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- CreateIndex
CREATE UNIQUE INDEX "unique_active_or_pending_offer_per_shipment" ON "offers"("shipmentId") WHERE (status IN ('PAYMENT_PENDING', 'ACCEPTED'));
