import { PrismaClient } from "@prisma/client";

// Türkçe yorum: Prisma client tekil instance; hot-reload sırasında çoğalmayı önlemek için globalde tutulur.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;

