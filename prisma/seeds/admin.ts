import prisma from "../../src/app/lib/prisma";
import { auth } from "../../src/app/lib/auth";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@shiffto.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
    return;
  }

  await auth.api.createUser({
    body: {
      email,
      password,
      name,
      role: "admin",
    },
  });

  console.log(`Admin user created: ${email}`);
}

seedAdmin()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
