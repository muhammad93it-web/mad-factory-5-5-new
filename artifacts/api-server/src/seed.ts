import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

export async function seedAdmin() {
  const count = await db.select({ n: sql<number>`count(*)` }).from(usersTable);
  if (Number(count[0]?.n) === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await db.insert(usersTable).values({
      username: "admin",
      passwordHash,
      role: "admin",
      permissions: JSON.stringify([]),
    });
  }
}
