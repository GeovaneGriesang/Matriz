import { PrismaClient } from "@prisma/client";

/**
 * Cliente único. Em desenvolvimento o Next recarrega os módulos a cada alteração,
 * e sem este cache cada recarga abriria um novo pool de conexões até o MySQL recusar.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalParaPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
