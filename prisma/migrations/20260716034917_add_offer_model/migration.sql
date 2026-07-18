-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "travellerId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "senderPrice" DOUBLE PRECISION NOT NULL,
    "offeredPrice" DOUBLE PRECISION NOT NULL,
    "bagType" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "isCounterOffer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offers_shipmentId_idx" ON "offers"("shipmentId");

-- CreateIndex
CREATE INDEX "offers_travellerId_idx" ON "offers"("travellerId");

-- CreateIndex
CREATE UNIQUE INDEX "offers_shipmentId_travellerId_key" ON "offers"("shipmentId", "travellerId");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_travellerId_fkey" FOREIGN KEY ("travellerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
