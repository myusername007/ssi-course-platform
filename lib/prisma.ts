// Single shared PrismaClient instance for the whole app. Prisma 7 requires
// an explicit driver adapter (no more implicit `new PrismaClient()` reading
// DATABASE_URL on its own) — see DESCRIPTION.md Stage 3 for why.
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Reuse the client across Next.js dev-server hot reloads to avoid exhausting
// the local Postgres connection pool (each PrismaClient owns its own pool).
export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
