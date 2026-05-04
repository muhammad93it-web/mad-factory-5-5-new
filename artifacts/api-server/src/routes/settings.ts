import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import { UpdateSettingsBody, VerifyDeletePinBody } from "@workspace/api-zod";

const router = Router();

async function ensureSettings() {
  const [settings] = await db.select().from(appSettingsTable);
  if (!settings) {
    const [s] = await db.insert(appSettingsTable).values({ factoryName: "Mad Factory", factoryNameKu: "کارگەی خشتی ماد" }).returning();
    return s;
  }
  return settings;
}

router.get("/settings", async (req, res): Promise<void> => {
  const settings = await ensureSettings();
  // Never expose the delete PIN over the read endpoint — verification happens
  // server-side via /settings/verify-delete-pin. Settings page indicates
  // whether a PIN exists via `deletePinSet` (boolean) only.
  const { deletePin, ...safe } = settings;
  res.json({
    ...safe,
    deletePinSet: !!deletePin,
    currentExchangeRate: settings.currentExchangeRate != null ? Number(settings.currentExchangeRate) : null,
    updatedAt: settings.updatedAt.toISOString(),
  });
});

router.post("/settings/verify-delete-pin", async (req, res): Promise<void> => {
  const parsed = VerifyDeletePinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const settings = await ensureSettings();
  res.json({ valid: settings.deletePin === parsed.data.pin });
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await ensureSettings();
  const [s] = await db.update(appSettingsTable).set(parsed.data).where(eq(appSettingsTable.id, existing.id)).returning();
  const { deletePin, ...safe } = s;
  res.json({
    ...safe,
    deletePinSet: !!deletePin,
    currentExchangeRate: s.currentExchangeRate != null ? Number(s.currentExchangeRate) : null,
    updatedAt: s.updatedAt.toISOString(),
  });
});

export default router;
