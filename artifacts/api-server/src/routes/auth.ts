import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return res.status(400).json({ error: "ناوی بەکارهێنەر و وشەی نهێنی پێویستن" });
    }
    const users = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    const user = users[0];
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە" });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە" });
    }
    const perms: string[] = JSON.parse(user.permissions);
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.permissions = perms;
    return res.json({ id: user.id, username: user.username, role: user.role, permissions: perms });
  } catch (err) {
    return res.status(500).json({ error: "هەڵەی سێرڤەر" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {});
  return res.json({ ok: true });
});

router.get("/auth/users", async (_req, res) => {
  try {
    const users = await db
      .select({ id: usersTable.id, username: usersTable.username, role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.isActive, true))
      .orderBy(usersTable.username);
    return res.json(users);
  } catch {
    return res.status(500).json({ error: "هەڵەی سێرڤەر" });
  }
});

router.get("/auth/me", (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "نەچووتەژوورەوە" });
  }
  return res.json({
    id: req.session.userId,
    username: req.session.username,
    role: req.session.role,
    permissions: req.session.permissions,
  });
});

export default router;
