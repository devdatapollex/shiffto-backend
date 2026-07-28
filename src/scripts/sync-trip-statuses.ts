import prisma from "../app/lib/prisma";
import { ShipmentStatus, shipmentStepStage } from "../generated/prisma/enums";

async function syncTripStatuses() {
  console.log("Starting trip status synchronization...");

  const trips = await prisma.trip.findMany({
    where: {
      status: { in: ["ACTIVE", "PENDING", "IN_TRANSIT", "ARRIVED"] },
    },
    include: {
      shipments: {
        include: {
          shipmentSteps: true,
        },
      },
    },
  });

  console.log(`Found ${trips.length} active/pending/ongoing trips to inspect.`);

  let updatedCount = 0;

  for (const trip of trips) {
    if (!trip.shipments || trip.shipments.length === 0) {
      continue;
    }

    const totalShipments = trip.shipments.length;
    const deliveredCount = trip.shipments.filter(
      (s) => s.status === ShipmentStatus.DELIVERED,
    ).length;

    let targetStatus: "COMPLETED" | "ARRIVED" | "IN_TRANSIT" | null = null;

    if (totalShipments > 0 && deliveredCount === totalShipments) {
      targetStatus = "COMPLETED";
    } else {
      // Check if any shipment completed ARRIVED_AT_DESTINATION step
      const hasArrivedStep = trip.shipments.some((s) =>
        s.shipmentSteps.some(
          (step) =>
            step.stage === shipmentStepStage.ARRIVED_AT_DESTINATION &&
            step.completedAt !== null,
        ),
      );

      if (hasArrivedStep) {
        if (trip.status !== "ARRIVED" && trip.status !== "COMPLETED") {
          targetStatus = "ARRIVED";
        }
      } else {
        // Check if any shipment completed CHECKED_IN step
        const hasCheckedInStep = trip.shipments.some((s) =>
          s.shipmentSteps.some(
            (step) =>
              step.stage === shipmentStepStage.CHECKED_IN &&
              step.completedAt !== null,
          ),
        );

        if (hasCheckedInStep) {
          if (
            trip.status !== "IN_TRANSIT" &&
            trip.status !== "ARRIVED" &&
            trip.status !== "COMPLETED"
          ) {
            targetStatus = "IN_TRANSIT";
          }
        }
      }
    }

    if (targetStatus && targetStatus !== trip.status) {
      await prisma.trip.update({
        where: { id: trip.id },
        data: { status: targetStatus },
      });
      console.log(
        `Updated Trip [${trip.id}] (Flight ${trip.flightNumber}): status '${trip.status}' -> '${targetStatus}' (Shipments: ${deliveredCount}/${totalShipments} delivered)`,
      );
      updatedCount++;
    }
  }

  console.log(
    `Trip status synchronization complete. Total trips updated: ${updatedCount}`,
  );
  process.exit(0);
}

syncTripStatuses().catch((err) => {
  console.error("Error synchronizing trip statuses:", err);
  process.exit(1);
});
