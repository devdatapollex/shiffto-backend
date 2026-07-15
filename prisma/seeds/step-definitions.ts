import prisma from "../../src/app/lib/prisma";

const stepDefinitions = [
  {
    stage: "PAYMENT_CONFIRMED" as const,
    label: "Payment confirmed",
    order: 1,
    description: null,
  },
  {
    stage: "PICKED_UP" as const,
    label: "Picked up",
    order: 2,
    description: null,
  },
  {
    stage: "CHECKED_IN" as const,
    label: "Checked in",
    order: 3,
    description: null,
  },
  {
    stage: "IN_TRANSIT" as const,
    label: "In transit",
    order: 4,
    description: "Flight is on the way to destination",
  },
  {
    stage: "ARRIVED_AT_DESTINATION" as const,
    label: "Arrived at destination",
    order: 5,
    description: null,
  },
  {
    stage: "OUT_FOR_DELIVERY" as const,
    label: "Out for delivery",
    order: 6,
    description: null,
  },
  {
    stage: "DELIVERED" as const,
    label: "Delivered",
    order: 7,
    description: null,
  },
];

async function seedStepDefinitions() {
  for (const def of stepDefinitions) {
    await prisma.stepDefinition.upsert({
      where: { stage: def.stage },
      update: {
        label: def.label,
        order: def.order,
        description: def.description,
      },
      create: def,
    });
  }

  const count = await prisma.stepDefinition.count();
  console.log(`Step definitions seeded (${count} total)`);
}

seedStepDefinitions()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
