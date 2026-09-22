// Cliente único de Prisma. En desarrollo, Next.js recarga los módulos
// seguido; esto evita abrir una conexión nueva a la base cada vez.
import { PrismaClient } from "@prisma/client";

const globalParaPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalParaPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = prisma;
