import prisma from "../../src/app/lib/prisma";
import { auth } from "../../src/app/lib/auth";

const tripsToSeed = [
  {
    flightNumber: "AA-101",
    fromCountry: "United States",
    toCountry: "United Kingdom",
    flightTime: "14:30",
    cabinBagCapacity: 7.0,
    checkInBagCapacity: 23.0,
  },
  {
    flightNumber: "LH-456",
    fromCountry: "Canada",
    toCountry: "Germany",
    flightTime: "18:00",
    cabinBagCapacity: 8.0,
    checkInBagCapacity: 30.0,
  },
  {
    flightNumber: "EK-582",
    fromCountry: "Bangladesh",
    toCountry: "United Arab Emirates",
    flightTime: "09:15",
    cabinBagCapacity: 10.0,
    checkInBagCapacity: 40.0,
  },
  {
    flightNumber: "JL-006",
    fromCountry: "France",
    toCountry: "Japan",
    flightTime: "23:45",
    cabinBagCapacity: 7.0,
    checkInBagCapacity: 23.0,
  },
  {
    flightNumber: "SQ-231",
    fromCountry: "Australia",
    toCountry: "Singapore",
    flightTime: "11:30",
    cabinBagCapacity: 10.0,
    checkInBagCapacity: 30.0,
  },
];

async function seedTrips() {
  console.log("Starting trips seed...");

  // 1. Get or create traveller user
  const email = "traveller.test@shiffto.com";
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`Creating test traveller user: ${email}...`);
    await auth.api.createUser({
      body: {
        email,
        password: "Password123!",
        name: "Test Traveller",
        role: "user",
      },
    });
    user = await prisma.user.findUnique({ where: { email } });
  }

  if (!user) {
    throw new Error("Failed to find or create traveller user.");
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
        documentNumber: "B87654321",
        nationality: "British",
        phoneNumber: "+447700900088",
        frontPhotoUrl: "https://example.com/passport-front.jpg",
        frontPhotoKey: "passport-front-traveller",
        backPhotoUrl: "https://example.com/passport-back.jpg",
        backPhotoKey: "passport-back-traveller",
        status: "APPROVED",
      },
    });
  } else if (kyc.status !== "APPROVED") {
    await prisma.kyc.update({
      where: { userId: user.id },
      data: { status: "APPROVED" },
    });
  }

  // 2. Seed Trips
  console.log("Seeding trips...");
  const flightDate = new Date();
  flightDate.setDate(flightDate.getDate() + 14); // 14 days from now

  for (const item of tripsToSeed) {
    // Check if trip already exists for this user with the same flightNumber and date
    const existingTrip = await prisma.trip.findFirst({
      where: {
        flightNumber: item.flightNumber,
        userId: user.id,
        fromCountry: item.fromCountry,
        toCountry: item.toCountry,
      },
    });

    if (existingTrip) {
      console.log(`Trip "${item.flightNumber}" already exists.`);
      continue;
    }

    await prisma.trip.create({
      data: {
        flightNumber: item.flightNumber,
        fromCountry: item.fromCountry,
        toCountry: item.toCountry,
        flightDate,
        flightTime: item.flightTime,
        cabinBagCapacity: item.cabinBagCapacity,
        checkInBagCapacity: item.checkInBagCapacity,
        remainingCabinCapacity: item.cabinBagCapacity,
        remainingCheckInCapacity: item.checkInBagCapacity,
        ticketPhoto: "https://example.com/ticket.jpg",
        status: "ACTIVE", // APPROVED status is mapped as ACTIVE in the system
        userId: user.id,
      },
    });

    console.log(`Successfully seeded active trip: ${item.flightNumber} (${item.fromCountry} -> ${item.toCountry})`);
  }

  console.log("Trips seeding completed successfully!");
}

seedTrips()
  .catch((e) => {
    console.error("Error seeding trips:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
