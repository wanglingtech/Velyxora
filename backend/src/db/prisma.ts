import { PrismaClient } from '@prisma/client';

const globalDb = globalThis as unknown as { velyxoraPrisma?: PrismaClient };
export const prisma = globalDb.velyxoraPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalDb.velyxoraPrisma = prisma;
