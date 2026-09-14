import { PrismaClient } from "@prisma/client";
import { seedInitialData } from "../backend/src/services/seedService";

const prisma = new PrismaClient();

const email = process.env.INITIAL_ADMIN_EMAIL;
const password = process.env.INITIAL_ADMIN_PASSWORD;

try {
  const result = await seedInitialData(
    prisma,
    email && password ? { email, password } : undefined,
  );

  console.log(
    result.adminSeeded
      ? "Planes y admin inicial verificados desde variables de entorno."
      : "Planes creados. Admin omitido: define INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD.",
  );
} finally {
  await prisma.$disconnect();
}
