import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

function resolveDbUrl(): string {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  // DATABASE_URL is "file:./dev.db" — resolve relative to project root
  const filePath = raw.replace(/^file:/, "");
  const absolute = path.resolve(process.cwd(), filePath);
  return `file:${absolute}`;
}

function createPrismaClient() {
  const adapter = new PrismaLibSql({ url: resolveDbUrl() });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
