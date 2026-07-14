import prisma from "../../src/app/lib/prisma";
import { auth } from "../../src/app/lib/auth";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "shiffto.admin@gmail.com";
  const password = process.env.ADMIN_PASSWORD || "12345678";
  const name = process.env.ADMIN_NAME || "Shiffto Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { emailVerified: true },
    });
    console.log(`Admin user already exists (ensured verified): ${email}`);
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

  await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
  });

  console.log(`Admin user created and verified: ${email}`);
}

seedAdmin()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
