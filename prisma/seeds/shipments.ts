import prisma from "../../src/app/lib/prisma";
import { auth } from "../../src/app/lib/auth";
import { shipmentStepStage } from "../../src/generated/prisma/enums";

const defaultCategories = [
  {
    name: "Electronics",
    slug: "electronics",
    minPrice: 10,
    maxPrice: 100,
    maxWeight: 50,
    maxQuantity: 10,
  },
  {
    name: "Clothing",
    slug: "clothing",
    minPrice: 5,
    maxPrice: 50,
    maxWeight: 100,
    maxQuantity: 50,
  },
  {
    name: "Documents",
    slug: "documents",
    minPrice: 2,
    maxPrice: 20,
    maxWeight: 2,
    maxQuantity: 5,
  },
  {
    name: "Food Items",
    slug: "food-items",
    minPrice: 4,
    maxPrice: 30,
    maxWeight: 30,
    maxQuantity: 20,
  },
];

const shipmentsToSeed = [
  {
    itemName: "iPhone 15 Pro",
    weight: 0.5,
    quantity: 1,
    description: "Brand new iPhone 15 Pro, sealed box.",
    itemPhotos: ["https://example.com/iphone15.jpg"],
    instructions: "Handle with care, keep in cabin bag.",
    fromCountry: "United States",
    toCountry: "United Kingdom",
    pricePerKg: 25.0,
    receiverName: "John Doe",
    receiverPhone: "+447700900077",
    receiverAddress: "10 Downing St, London, UK",
    categorySlug: "electronics",
  },
  {
    itemName: "Winter Jacket",
    weight: 2.0,
    quantity: 2,
    description: "Warm woolen coats for winter.",
    itemPhotos: ["https://example.com/jacket.jpg"],
    instructions: "Fold neatly.",
    fromCountry: "Canada",
    toCountry: "Germany",
    pricePerKg: 12.0,
    receiverName: "Max Mustermann",
    receiverPhone: "+491701234567",
    receiverAddress: "Alexanderplatz 1, Berlin, Germany",
    categorySlug: "clothing",
  },
  {
    itemName: "Official Deeds",
    weight: 0.1,
    quantity: 1,
    description: "Urgent legal documents.",
    itemPhotos: ["https://example.com/documents.jpg"],
    instructions: "Do not bend. Keep dry.",
    fromCountry: "Bangladesh",
    toCountry: "United Arab Emirates",
    pricePerKg: 15.0,
    receiverName: "Ahmed Al-Mansoori",
    receiverPhone: "+971501234567",
    receiverAddress: "Sheikh Zayed Rd, Dubai, UAE",
    categorySlug: "documents",
  },
  {
    itemName: "Traditional Sweets (Misti)",
    weight: 3.0,
    quantity: 3,
    description: "Delicious dry sweets.",
    itemPhotos: ["https://example.com/sweets.jpg"],
    instructions: "Keep in a cool dry place.",
    fromCountry: "France",
    toCountry: "Japan",
    pricePerKg: 10.0,
    receiverName: "Kenji Tanaka",
    receiverPhone: "+819012345678",
    receiverAddress: "Shibuya 1-chome, Tokyo, Japan",
    categorySlug: "food-items",
  },
  {
    itemName: "Designer Shoes",
    weight: 1.5,
    quantity: 1,
    description: "Running shoes.",
    itemPhotos: ["https://example.com/shoes.jpg"],
    instructions: "Keep in shoe box.",
    fromCountry: "Australia",
    toCountry: "Singapore",
    pricePerKg: 20.0,
    receiverName: "Sarah Lim",
    receiverPhone: "+6591234567",
    receiverAddress: "Orchard Rd, Singapore",
    categorySlug: "clothing",
  },
];

async function seedShipments() {
  console.log("Starting shipments seed...");

  // 1. Get or create sender user
  const email = "sender.test@shiffto.com";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`Creating test sender user: ${email}...`);
    await auth.api.createUser({
      body: {
        email,
        password: "Password123!",
        name: "Test Sender",
        role: "user",
      },
    });
    user = await prisma.user.findUnique({ where: { email } });
  }

  if (!user) {
    throw new Error("Failed to find or create sender user.");
  }

  // Ensure user is verified and has approved KYC
  await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });

  const kyc = await prisma.kyc.findUnique({ where: { userId: user.id } });
  if (!kyc) {
    await prisma.kyc.create({
      data: {
        userId: user.id,
        documentType: "PASSPORT",
        documentNumber: "A12345678",
        nationality: "American",
        phoneNumber: "+15555555555",
        frontPhotoUrl: "https://example.com/passport-front.jpg",
        frontPhotoKey: "passport-front",
        backPhotoUrl: "https://example.com/passport-back.jpg",
        backPhotoKey: "passport-back",
        status: "APPROVED",
      },
    });
  } else if (kyc.status !== "APPROVED") {
    await prisma.kyc.update({
      where: { userId: user.id },
      data: { status: "APPROVED" },
    });
  }

  // 2. Ensure categories exist
  console.log("Upserting shipment categories...");
  for (const cat of defaultCategories) {
    await prisma.shipmentCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
  }

  // 3. Ensure step definitions exist
  const stepDefinitions = await prisma.stepDefinition.findMany({
    orderBy: { order: "asc" },
  });

  if (stepDefinitions.length === 0) {
    console.log(
      "No step definitions found. Seeding default step definitions...",
    );
    const defaultSteps = [
      {
        stage: shipmentStepStage.PAYMENT_CONFIRMED,
        label: "Payment confirmed",
        order: 1,
        description: null,
      },
      {
        stage: shipmentStepStage.PICKED_UP,
        label: "Picked up",
        order: 2,
        description: null,
      },
      {
        stage: shipmentStepStage.CHECKED_IN,
        label: "Checked in",
        order: 3,
        description: null,
      },
      {
        stage: shipmentStepStage.IN_TRANSIT,
        label: "In transit",
        order: 4,
        description: "Flight is on the way to destination",
      },
      {
        stage: shipmentStepStage.ARRIVED_AT_DESTINATION,
        label: "Arrived at destination",
        order: 5,
        description: null,
      },
      {
        stage: shipmentStepStage.OUT_FOR_DELIVERY,
        label: "Out for delivery",
        order: 6,
        description: null,
      },
      {
        stage: shipmentStepStage.DELIVERED,
        label: "Delivered",
        order: 7,
        description: null,
      },
    ];
    for (const def of defaultSteps) {
      await prisma.stepDefinition.upsert({
        where: { stage: def.stage },
        update: def,
        create: def,
      });
    }
  }

  // Reload step definitions to be sure we have their IDs
  const finalStepDefinitions = await prisma.stepDefinition.findMany({
    orderBy: { order: "asc" },
  });

  // 4. Seed Shipments
  console.log("Seeding shipments...");
  for (const item of shipmentsToSeed) {
    const category = await prisma.shipmentCategory.findUnique({
      where: { slug: item.categorySlug },
    });
    if (!category) {
      throw new Error(`Category with slug ${item.categorySlug} not found.`);
    }

    // Check if shipment already exists with the same itemName and receiverName for this user
    const existingShipment = await prisma.shipment.findFirst({
      where: {
        itemName: item.itemName,
        receiverName: item.receiverName,
        userId: user.id,
      },
    });

    if (existingShipment) {
      console.log(`Shipment "${item.itemName}" already exists.`);
      continue;
    }

    const createdShipment = await prisma.shipment.create({
      data: {
        itemName: item.itemName,
        weight: item.weight,
        quantity: item.quantity,
        description: item.description,
        itemPhotos: item.itemPhotos,
        instructions: item.instructions,
        fromCountry: item.fromCountry,
        toCountry: item.toCountry,
        pricePerKg: item.pricePerKg,
        receiverName: item.receiverName,
        receiverPhone: item.receiverPhone,
        receiverAddress: item.receiverAddress,
        categoryId: category.id,
        userId: user.id,
        status: "AWAITING_MATCH",
      },
    });

    // Create Shipment Steps
    for (const def of finalStepDefinitions) {
      await prisma.shipmentStep.create({
        data: {
          shipmentId: createdShipment.id,
          definitionId: def.id,
          stage: def.stage,
          order: def.order,
          isCurrent: def.order === 1,
          completedAt: null,
        },
      });
    }

    console.log(
      `Successfully seeded shipment: ${item.itemName} (${item.fromCountry} -> ${item.toCountry})`,
    );
  }

  console.log("Shipments seeding completed successfully!");
}

seedShipments()
  .catch((e) => {
    console.error("Error seeding shipments:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
