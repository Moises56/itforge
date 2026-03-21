import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

type PrismaCache = {
  // Store the constructor reference used to create this client.
  // When Prisma regenerates (schema change), the module re-evaluates and
  // PrismaClient becomes a new object — mismatch clears the stale singleton.
  ctor:   typeof PrismaClient
  client: ReturnType<typeof createPrismaClient>
}

const g = globalThis as { __prismaCache?: PrismaCache }

if (!g.__prismaCache || g.__prismaCache.ctor !== PrismaClient) {
  if (g.__prismaCache) {
    // Disconnect stale client (fire-and-forget to avoid blocking)
    g.__prismaCache.client.$disconnect().catch(() => {})
  }
  g.__prismaCache = { ctor: PrismaClient, client: createPrismaClient() }
}

export const prisma = g.__prismaCache.client
