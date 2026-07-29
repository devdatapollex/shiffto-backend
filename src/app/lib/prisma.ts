import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "../../generated/prisma/client";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

export const getPoolStats = () => ({
  total: pool.totalCount,
  idle: pool.idleCount,
  active: pool.totalCount - pool.idleCount,
  waiting: pool.waitingCount,
  maxAllowed: 20,
});

if (process.env.NODE_ENV !== "production") {
  setInterval(() => {
    const stats = getPoolStats();
    if (stats.waiting > 0 || stats.active >= 15) {
      console.warn("⚠️ [DB Pool Alert]", stats);
    }
  }, 3000);
}

export default prisma;
