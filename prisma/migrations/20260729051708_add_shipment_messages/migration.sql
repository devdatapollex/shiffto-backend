/*
  Warnings:

  - A unique constraint covering the columns `[shipmentId]` on the table `offers` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "unique_active_or_pending_offer_per_shipment";

-- CreateTable
CREATE TABLE "shipment_messages" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_messages_shipmentId_createdAt_idx" ON "shipment_messages"("shipmentId", "createdAt");

-- CreateIndex
CREATE INDEX "shipment_messages_shipmentId_isRead_idx" ON "shipment_messages"("shipmentId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "unique_active_or_pending_offer_per_shipment" ON "offers"("shipmentId") WHERE (status IN ('PAYMENT_PENDING', 'ACCEPTED'));

-- AddForeignKey
ALTER TABLE "shipment_messages" ADD CONSTRAINT "shipment_messages_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_messages" ADD CONSTRAINT "shipment_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
