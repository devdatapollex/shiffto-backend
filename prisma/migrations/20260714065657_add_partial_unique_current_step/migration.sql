-- Partial unique index: at most one current step per shipment
    CREATE UNIQUE INDEX "shipment_steps_one_current_per_shipment"
      ON "shipment_steps" ("shipmentId")
      WHERE "isCurrent" = true;

    -- Defensive CHECK: boolean integrity
    ALTER TABLE "shipment_steps"
      ADD CONSTRAINT "shipment_steps_is_current_boolean_check"
      CHECK ("isCurrent" IN (true, false));