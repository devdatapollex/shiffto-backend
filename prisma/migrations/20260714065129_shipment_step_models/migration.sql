-- CreateEnum
CREATE TYPE "shipmentStepStage" AS ENUM ('PAYMENT_CONFIRMED', 'PICKED_UP', 'CHECKED_IN', 'IN_TRANSIT', 'ARRIVED_AT_DESTINATION', 'OUT_FOR_DELIVERY', 'DELIVERED');

-- CreateTable
CREATE TABLE "step_definitions" (
    "id" TEXT NOT NULL,
    "stage" "shipmentStepStage" NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT,

    CONSTRAINT "step_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_steps" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "stage" "shipmentStepStage" NOT NULL,
    "order" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "step_definitions_stage_key" ON "step_definitions"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "step_definitions_order_key" ON "step_definitions"("order");

-- CreateIndex
CREATE INDEX "shipment_steps_shipmentId_order_idx" ON "shipment_steps"("shipmentId", "order");

-- CreateIndex
CREATE INDEX "shipment_steps_shipmentId_isCurrent_idx" ON "shipment_steps"("shipmentId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_steps_shipmentId_order_key" ON "shipment_steps"("shipmentId", "order");

-- AddForeignKey
ALTER TABLE "shipment_steps" ADD CONSTRAINT "shipment_steps_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_steps" ADD CONSTRAINT "shipment_steps_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "step_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
