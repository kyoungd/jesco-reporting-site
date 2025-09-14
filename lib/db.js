import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

export const db = globalForPrisma.prisma || new PrismaClient()
export const prisma = db // Export as both names for compatibility

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db