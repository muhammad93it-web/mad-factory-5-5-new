import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, exchangeRatesTable, appSettingsTable } from "@workspace/db";
import {
  ListExchangeRatesQueryParams,
  CreateExchangeRateBody,
  UpdateExchangeRateParams,
  UpdateExchangeRateBody,
} from "@workspace/api-zod";

const router = Router();

function mapRate(r: typeof exchangeRatesTable.$inferSelect) {
  return { ...r, rate: Number(r.rate), createdAt: r.createdAt.toISOString() };
}

router.get("/exchange-rates", async (req, res): Promise<void> => {
  const qp = ListExchangeRatesQueryParams.safeParse(req.query);
  const limit = qp.success && qp.data.limit ? qp.data.limit : 50;
  const rates = await db
    .select()
    .from(exchangeRatesTable)
    .orderBy(desc(exchangeRatesTable.rateDate), desc(exchangeRatesTable.id))
    .limit(limit);
  res.json(rates.map(mapRate));
});

router.get("/exchange-rates/latest", async (req, res): Promise<void> => {
  const [rate] = await db
    .select()
    .from(exchangeRatesTable)
    .orderBy(desc(exchangeRatesTable.rateDate), desc(exchangeRatesTable.id))
    .limit(1);
  if (!rate) {
    res.status(404).json({ error: "No exchange rate found" });
    return;
  }
  res.json(mapRate(rate));
});

router.post("/exchange-rates", async (req, res): Promise<void> => {
  const parsed = CreateExchangeRateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Upsert by date: if a rate already exists for this date, update the
  // newest one (highest id) and remove any older duplicates so /latest
  // is always deterministic. This guarantees the user's newest value
  // for a given day is the one returned by /latest.
  const existing = await db
    .select()
    .from(exchangeRatesTable)
    .where(eq(exchangeRatesTable.rateDate, parsed.data.rateDate))
    .orderBy(desc(exchangeRatesTable.id));

  let rate;
  if (existing.length > 0) {
    const keep = existing[0];
    [rate] = await db
      .update(exchangeRatesTable)
      .set({ rate: String(parsed.data.rate), notes: parsed.data.notes ?? keep.notes })
      .where(eq(exchangeRatesTable.id, keep.id))
      .returning();
    // Drop any older duplicate rows for the same date.
    for (const dup of existing.slice(1)) {
      await db.delete(exchangeRatesTable).where(eq(exchangeRatesTable.id, dup.id));
    }
  } else {
    [rate] = await db
      .insert(exchangeRatesTable)
      .values({ ...parsed.data, rate: String(parsed.data.rate) })
      .returning();
  }

  // Mirror to app settings as a convenience field.
  await db
    .update(appSettingsTable)
    .set({ currentExchangeRate: String(parsed.data.rate) })
    .where(eq(appSettingsTable.id, 1));

  res.status(201).json(mapRate(rate));
});

router.patch("/exchange-rates/:id", async (req, res): Promise<void> => {
  const params = UpdateExchangeRateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateExchangeRateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [rate] = await db.update(exchangeRatesTable).set({ ...parsed.data, rate: String(parsed.data.rate) }).where(eq(exchangeRatesTable.id, params.data.id)).returning();
  if (!rate) {
    res.status(404).json({ error: "Exchange rate not found" });
    return;
  }
  res.json(mapRate(rate));
});

export default router;
