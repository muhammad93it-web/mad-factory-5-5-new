import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, incomesTable } from "@workspace/db";
import {
  ListIncomesQueryParams,
  CreateIncomeBody,
  UpdateIncomeParams,
  UpdateIncomeBody,
  DeleteIncomeParams,
} from "@workspace/api-zod";

const router = Router();

function mapIncome(i: typeof incomesTable.$inferSelect) {
  return { ...i, amount: Number(i.amount), createdAt: i.createdAt.toISOString() };
}

router.get("/incomes", async (req, res): Promise<void> => {
  const qp = ListIncomesQueryParams.safeParse(req.query);
  const conditions: ReturnType<typeof eq>[] = [];
  if (qp.success) {
    if (qp.data.category) conditions.push(eq(incomesTable.category, qp.data.category));
    if (qp.data.fromDate) conditions.push(sql`income_date >= ${qp.data.fromDate}` as ReturnType<typeof eq>);
    if (qp.data.toDate) conditions.push(sql`income_date <= ${qp.data.toDate}` as ReturnType<typeof eq>);
  }
  const incomes = await db.select().from(incomesTable).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(incomesTable.incomeDate));
  res.json(incomes.map(mapIncome));
});

router.post("/incomes", async (req, res): Promise<void> => {
  const parsed = CreateIncomeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [i] = await db.insert(incomesTable).values({ ...parsed.data, amount: String(parsed.data.amount) }).returning();
  res.status(201).json(mapIncome(i));
});

router.patch("/incomes/:id", async (req, res): Promise<void> => {
  const params = UpdateIncomeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateIncomeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);
  const [i] = await db.update(incomesTable).set(updateData).where(eq(incomesTable.id, params.data.id)).returning();
  if (!i) {
    res.status(404).json({ error: "Income not found" });
    return;
  }
  res.json(mapIncome(i));
});

router.delete("/incomes/:id", async (req, res): Promise<void> => {
  const params = DeleteIncomeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(incomesTable).where(eq(incomesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
