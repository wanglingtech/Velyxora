import { PrismaClient } from "@prisma/client";
import { seedInitialData } from "../backend/src/services/seedService";

const prisma = new PrismaClient();

const email = process.env.INITIAL_ADMIN_EMAIL;
const password = process.env.INITIAL_ADMIN_PASSWORD;
const updateExistingPassword = process.env.INITIAL_ADMIN_UPDATE_EXISTING_PASSWORD === "true";

try {
  console.log("ADMIN_SEED_CONFIG", {
    emailConfigured: Boolean(email),
    passwordConfigured: Boolean(password),
    pepperConfigured: Boolean(process.env.AUTH_PASSWORD_PEPPER),
    updateExistingPassword,
  });
  const result = await seedInitialData(
    prisma,
    email && password ? { email, password, updateExistingPassword } : undefined,
  );

  if (result.adminConfigured && result.status !== "ACTIVE") {
    throw new Error("El admin configurado existe pero su estado no permite iniciar sesión.");
  }
  if (result.adminConfigured && result.passwordMatches === false) {
    throw new Error("El admin configurado ya existe, pero la contraseña configurada no coincide. No se modificó el hash existente.");
  }
  console.log(
    result.adminSeeded
      ? "Admin inicial verificado desde variables de entorno."
      : "Admin omitido: define INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD.",
  );
} finally {
  await prisma.$disconnect();
}
