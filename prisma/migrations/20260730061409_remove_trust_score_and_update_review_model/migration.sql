/*
  Warnings:

  - You are about to drop the column `trustScore` on the `user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[shipmentId]` on the table `offers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shipmentId]` on the table `reviews` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `shipmentId` to the `reviews` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "unique_active_or_pending_offer_per_shipment";

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "shipmentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user" DROP COLUMN "trustScore";

-- CreateIndex
CREATE UNIQUE INDEX "unique_active_or_pending_offer_per_shipment" ON "offers"("shipmentId") WHERE (status IN ('PAYMENT_PENDING', 'ACCEPTED'));

-- CreateIndex
CREATE UNIQUE INDEX "reviews_shipmentId_key" ON "reviews"("shipmentId");

-- CreateIndex
CREATE INDEX "reviews_revieweeId_idx" ON "reviews"("revieweeId");

-- CreateIndex
CREATE INDEX "reviews_reviewerId_idx" ON "reviews"("reviewerId");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
