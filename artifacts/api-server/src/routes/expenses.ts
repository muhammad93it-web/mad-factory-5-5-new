import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, expensesTable } from "@workspace/db";
import {
  ListExpensesQueryParams,
  CreateExpenseBody,
  UpdateExpenseParams,
  UpdateExpenseBody,
  DeleteExpenseParams,
} from "@workspace/api-zod";

const router = Router();

function mapExpense(e: typeof expensesTable.$inferSelect) {
  return { ...e, amount: Number(e.amount), createdAt: e.createdAt.toISOString() };
}

router.get("/expenses", async (req, res): Promise<void> => {
  const qp = ListExpensesQueryParams.safeParse(req.query);
  const conditions: ReturnType<typeof eq>[] = [];
  if (qp.success) {
    if (qp.data.category) conditions.push(eq(expensesTable.category, qp.data.category));
    if (qp.data.fromDate) conditions.push(sql`expense_date >= ${qp.data.fromDate}` as ReturnType<typeof eq>);
    if (qp.data.toDate) conditions.push(sql`expense_date <= ${qp.data.toDate}` as ReturnType<typeof eq>);
  }
  const expenses = await db.select().from(expensesTable).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(expensesTable.expenseDate));
  res.json(expenses.map(mapExpense));
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [e] = await db.insert(expensesTable).values({ ...parsed.data, amount: String(parsed.data.amount) }).returning();
  res.status(201).json(mapExpense(e));
});

router.patch("/expenses/:id", async (req, res): Promise<void> => {
  const params = UpdateExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);
  const [e] = await db.update(expensesTable).set(updateData).where(eq(expensesTable.id, params.data.id)).returning();
  if (!e) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(mapExpense(e));
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(expensesTable).where(eq(expensesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
