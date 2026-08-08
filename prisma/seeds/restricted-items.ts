import prisma from "../../src/app/lib/prisma.js";

const DEFAULT_RESTRICTED_ITEMS = [
  {
    name: "Explosives, flammables, and fireworks",
    description: "Includes dynamite, flares, fireworks, and volatile fuels",
  },
  {
    name: "Illegal drugs and controlled substances",
    description:
      "Narcotics, unprescribed pharmaceutical drugs, and illicit chemicals",
  },
  {
    name: "Weapons, ammunition, and firearms",
    description: "Guns, blades, explosives, and tactical weaponry components",
  },
  {
    name: "Counterfeit currency and goods",
    description:
      "Forged banknotes, fake designer goods, and unauthorized replicas",
  },
  {
    name: "Live animals and animal products",
    description:
      "Living organisms, endangered species, and untamed animal products",
  },
  {
    name: "Radioactive and toxic materials",
    description: "Hazardous chemicals, nuclear waste, and biohazard materials",
  },
  {
    name: "Corrosive substances (acids, mercury)",
    description: "Strong acids, alkalis, mercury, and rust removers",
  },
  {
    name: "Compressed gases and aerosols",
    description:
      "Fire extinguishers, spray cans, and pressurized gas cylinders",
  },
  {
    name: "Oxidizing substances and organic peroxides",
    description: "Bleaches, pool chemicals, and chemical oxidizers",
  },
  {
    name: "Flammable liquids and solids",
    description: "Paints, thinners, lighter fluid, and matches",
  },
  {
    name: "Human remains or body parts",
    description: "Cremated remains, tissue samples, and biological specimens",
  },
  {
    name: "Precious metals and stones",
    description: "Unset gemstones, gold bars, and high-value bullion",
  },
  {
    name: "Cash, currency, or negotiable instruments",
    description: "Physical paper currency, bearer bonds, and uncashed checks",
  },
  {
    name: "Pornographic or obscene materials",
    description: "Prohibited adult content and explicit contraband",
  },
  {
    name: "Counterfeit or pirated goods",
    description:
      "Bootleg electronics, pirated software, and trademark violations",
  },
  {
    name: "Endangered species and products thereof",
    description: "Ivory, animal pelts, and protected fauna/flora items",
  },
];

async function seedRestrictedItems() {
  console.log("Seeding restricted items...");
  for (const item of DEFAULT_RESTRICTED_ITEMS) {
    const existing = await prisma.restrictedItem.findFirst({
      where: { name: item.name },
    });
    if (!existing) {
      await prisma.restrictedItem.create({ data: item });
    }
  }
  console.log("Restricted items seeded successfully.");
}

seedRestrictedItems()
  .catch((e) => {
    console.error("Error seeding restricted items:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
