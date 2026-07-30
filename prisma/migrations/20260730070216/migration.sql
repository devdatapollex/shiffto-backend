/*
  Warnings:

  - A unique constraint covering the columns `[shipmentId]` on the table `offers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shipmentId,reviewerId]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "unique_active_or_pending_offer_per_shipment";

-- DropIndex
DROP INDEX "reviews_shipmentId_key";

-- CreateIndex
CREATE UNIQUE INDEX "unique_active_or_pending_offer_per_shipment" ON "offers"("shipmentId") WHERE (status IN ('PAYMENT_PENDING', 'ACCEPTED'));

-- CreateIndex
CREATE UNIQUE INDEX "reviews_shipmentId_reviewerId_key" ON "reviews"("shipmentId", "reviewerId");
