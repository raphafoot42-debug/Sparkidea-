import { PrismaClient } from "@prisma/client";

// En dev, Next.js recharge les modules à chaque changement de fichier, ce qui
// créerait une nouvelle connexion Prisma à chaque fois sans cette astuce.
// On garde une seule instance en mémoire globale.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
