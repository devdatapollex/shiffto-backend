/*
  Warnings:

  - A unique constraint covering the columns `[shipmentId]` on the table `offers` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "OfferStatus" ADD VALUE 'EXPIRED';

-- DropIndex
DROP INDEX "unique_active_or_pending_offer_per_shipment";

-- CreateIndex
CREATE UNIQUE INDEX "unique_active_or_pending_offer_per_shipment" ON "offers"("shipmentId") WHERE (status IN ('PAYMENT_PENDING', 'ACCEPTED'));
