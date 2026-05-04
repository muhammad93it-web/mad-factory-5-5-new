import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, shareholdersTable, shareholderTransactionsTable } from "@workspace/db";
import {
  CreateShareholderBody,
  GetShareholderParams,
  UpdateShareholderParams,
  UpdateShareholderBody,
  DeleteShareholderParams,
  ListShareholderTransactionsQueryParams,
  CreateShareholderTransactionBody,
  DeleteShareholderTransactionParams,
} from "@workspace/api-zod";

const router = Router();

async function getShareholderWithTotal(id: number) {
  const [s] = await db.select().from(shareholdersTable).where(eq(shareholdersTable.id, id));
  if (!s) return null;
  const [agg] = await db.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(shareholderTransactionsTable).where(and(eq(shareholderTransactionsTable.shareholderId, id), eq(shareholderTransactionsTable.type, "withdrawal")));
  return {
    ...s,
    sharePercentage: Number(s.sharePercentage),
    shareAmount: s.shareAmount != null ? Number(s.shareAmount) : null,
    totalWithdrawn: Number(agg.total),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/shareholders", async (req, res): Promise<void> => {
  const shareholders = await db.select().from(shareholdersTable).where(eq(shareholdersTable.isActive, true));
  const enriched = await Promise.all(shareholders.map((s) => getShareholderWithTotal(s.id)));
  res.json(enriched.filter(Boolean));
});

router.post("/shareholders", async (req, res): Promise<void> => {
  const parsed = CreateShareholderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [s] = await db.insert(shareholdersTable).values({
    ...parsed.data,
    sharePercentage: String(parsed.data.sharePercentage),
    shareAmount: parsed.data.shareAmount != null ? String(parsed.data.shareAmount) : null,
  }).returning();
  res.status(201).json(await getShareholderWithTotal(s.id));
});

router.get("/shareholders/:id", async (req, res): Promise<void> => {
  const params = GetShareholderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const s = await getShareholderWithTotal(params.data.id);
  if (!s) {
    res.status(404).json({ error: "Shareholder not found" });
    return;
  }
  res.json(s);
});

router.patch("/shareholders/:id", async (req, res): Promise<void> => {
  const params = UpdateShareholderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateShareholderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.sharePercentage !== undefined) updateData.sharePercentage = String(parsed.data.sharePercentage);
  if (parsed.data.shareAmount !== undefined) updateData.shareAmount = parsed.data.shareAmount != null ? String(parsed.data.shareAmount) : null;
  await db.update(shareholdersTable).set(updateData).where(eq(shareholdersTable.id, params.data.id));
  res.json(await getShareholderWithTotal(params.data.id));
});

router.delete("/shareholders/:id", async (req, res): Promise<void> => {
  const params = DeleteShareholderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(shareholdersTable).set({ isActive: false }).where(eq(shareholdersTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/shareholder-transactions", async (req, res): Promise<void> => {
  const qp = ListShareholderTransactionsQueryParams.safeParse(req.query);
  const conditions: ReturnType<typeof eq>[] = [];
  if (qp.success && qp.data.shareholderId) {
    conditions.push(eq(shareholderTransactionsTable.shareholderId, qp.data.shareholderId));
  }

  const transactions = await db
    .select({ t: shareholderTransactionsTable, name: shareholdersTable.name })
    .from(shareholderTransactionsTable)
    .leftJoin(shareholdersTable, eq(shareholderTransactionsTable.shareholderId, shareholdersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(shareholderTransactionsTable.transactionDate));

  res.json(transactions.map(({ t, name }) => ({
    ...t,
    shareholderName: name ?? "",
    amount: Number(t.amount),
    createdAt: t.createdAt.toISOString(),
  })));
});

router.post("/shareholder-transactions", async (req, res): Promise<void> => {
  const parsed = CreateShareholderTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [t] = await db.insert(shareholderTransactionsTable).values({
    ...parsed.data,
    amount: String(parsed.data.amount),
  }).returning();
  const [s] = await db.select({ name: shareholdersTable.name }).from(shareholdersTable).where(eq(shareholdersTable.id, parsed.data.shareholderId));
  res.status(201).json({ ...t, shareholderName: s?.name ?? "", amount: Number(t.amount), createdAt: t.createdAt.toISOString() });
});

router.delete("/shareholder-transactions/:id", async (req, res): Promise<void> => {
  const params = DeleteShareholderTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(shareholderTransactionsTable).where(eq(shareholderTransactionsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
