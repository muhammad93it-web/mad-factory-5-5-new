import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const router = Router();

router.get("/users", requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        role: usersTable.role,
        permissions: usersTable.permissions,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(usersTable.createdAt);
    return res.json(users.map((u) => ({ ...u, permissions: JSON.parse(u.permissions) })));
  } catch {
    return res.status(500).json({ error: "هەڵەی سێرڤەر" });
  }
});

router.post("/users", requireAdmin, async (req, res) => {
  try {
    const { username, password, role, permissions } = req.body as {
      username?: string;
      password?: string;
      role?: string;
      permissions?: string[];
    };
    if (!username || !password) {
      return res.status(400).json({ error: "ناو و وشەی نهێنی پێویستن" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const rows = await db
      .insert(usersTable)
      .values({
        username,
        passwordHash,
        role: role === "admin" ? "admin" : "employee",
        permissions: JSON.stringify(permissions ?? []),
      })
      .returning({ id: usersTable.id, username: usersTable.username, role: usersTable.role });
    return res.status(201).json(rows[0]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique")) {
      return res.status(409).json({ error: "ئەم ناوی بەکارهێنەرە پێشتر تۆمارکراوە" });
    }
    return res.status(500).json({ error: "هەڵەی سێرڤەر" });
  }
});

router.put("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    const { username, password, role, permissions, isActive } = req.body as {
      username?: string;
      password?: string;
      role?: string;
      permissions?: string[];
      isActive?: boolean;
    };
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (username) updates.username = username;
    if (role) updates.role = role === "admin" ? "admin" : "employee";
    if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);
    if (isActive !== undefined) updates.isActive = isActive;
    if (password) updates.passwordHash = await bcrypt.hash(password, 10);
    await db.update(usersTable).set(updates).where(eq(usersTable.id, id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "هەڵەی سێرڤەر" });
  }
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params["id"]);
    await db.delete(usersTable).where(eq(usersTable.id, id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "هەڵەی سێرڤەر" });
  }
});

export default router;
