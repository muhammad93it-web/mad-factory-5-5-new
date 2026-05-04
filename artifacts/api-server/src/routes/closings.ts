import { Router } from "express";
import { and, sql, desc, eq } from "drizzle-orm";
import {
  db,
  salesInvoicesTable,
  customerPaymentsTable,
  purchaseInvoicesTable,
  supplierPaymentsTable,
  payrollEntriesTable,
  expensesTable,
  incomesTable,
  shareholderTransactionsTable,
  shareholdersTable,
  monthlyClosingsTable,
  profitDistributionsTable,
} from "@workspace/db";
import {
  ListTreasuryMovementsQueryParams,
  CreateMonthlyClosingBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/cashbox/treasury-movements", async (req, res): Promise<void> => {
  const qp = ListTreasuryMovementsQueryParams.safeParse(req.query);
  const fromDate = qp.success ? qp.data.fromDate : undefined;
  const toDate = qp.success ? qp.data.toDate : undefined;

  type Row = { date: string; type: string; direction: "in" | "out"; amount: number; description: string; sourceModule: string; sourceId: number };
  const movements: Row[] = [];

  const salesConds = [
    eq(salesInvoicesTable.isDeleted, false),
    sql`${salesInvoicesTable.paidAmount} > 0`,
  ];
  if (fromDate) salesConds.push(sql`${salesInvoicesTable.invoiceDate} >= ${fromDate}`);
  if (toDate) salesConds.push(sql`${salesInvoicesTable.invoiceDate} <= ${toDate}`);
  const sales = await db
    .select({ id: salesInvoicesTable.id, invoiceDate: salesInvoicesTable.invoiceDate, invoiceNumber: salesInvoicesTable.invoiceNumber, paidAmount: salesInvoicesTable.paidAmount })
    .from(salesInvoicesTable)
    .where(and(...salesConds));
  for (const r of sales) movements.push({ date: r.invoiceDate, type: "فرۆشتن", direction: "in", amount: Number(r.paidAmount), description: `پسووڵەی فرۆشتن ${r.invoiceNumber}`, sourceModule: "sales", sourceId: r.id });

  const custPayConds = [];
  if (fromDate) custPayConds.push(sql`${customerPaymentsTable.paymentDate} >= ${fromDate}`);
  if (toDate) custPayConds.push(sql`${customerPaymentsTable.paymentDate} <= ${toDate}`);
  const custPays = await db
    .select({ id: customerPaymentsTable.id, paymentDate: customerPaymentsTable.paymentDate, amount: customerPaymentsTable.amount, customerId: customerPaymentsTable.customerId })
    .from(customerPaymentsTable)
    .where(custPayConds.length ? and(...custPayConds) : undefined);
  for (const r of custPays) movements.push({ date: r.paymentDate, type: "پارەدانی کڕیار", direction: "in", amount: Number(r.amount), description: `پارەدان لە کڕیار #${r.customerId}`, sourceModule: "customer-payments", sourceId: r.id });

  const incConds = [];
  if (fromDate) incConds.push(sql`${incomesTable.incomeDate} >= ${fromDate}`);
  if (toDate) incConds.push(sql`${incomesTable.incomeDate} <= ${toDate}`);
  const incomes = await db
    .select({ id: incomesTable.id, incomeDate: incomesTable.incomeDate, amount: incomesTable.amount, description: incomesTable.description, category: incomesTable.category })
    .from(incomesTable)
    .where(incConds.length ? and(...incConds) : undefined);
  for (const r of incomes) movements.push({ date: r.incomeDate, type: "داهاتی تر", direction: "in", amount: Number(r.amount), description: `${r.category}: ${r.description}`, sourceModule: "incomes", sourceId: r.id });

  const purchConds = [
    eq(purchaseInvoicesTable.isDeleted, false),
    sql`${purchaseInvoicesTable.paidAmountIqd} > 0`,
  ];
  if (fromDate) purchConds.push(sql`${purchaseInvoicesTable.invoiceDate} >= ${fromDate}`);
  if (toDate) purchConds.push(sql`${purchaseInvoicesTable.invoiceDate} <= ${toDate}`);
  const purch = await db
    .select({ id: purchaseInvoicesTable.id, invoiceDate: purchaseInvoicesTable.invoiceDate, invoiceNumber: purchaseInvoicesTable.invoiceNumber, paidAmountIqd: purchaseInvoicesTable.paidAmountIqd })
    .from(purchaseInvoicesTable)
    .where(and(...purchConds));
  for (const r of purch) movements.push({ date: r.invoiceDate, type: "کڕین", direction: "out", amount: Number(r.paidAmountIqd), description: `پسووڵەی کڕین ${r.invoiceNumber}`, sourceModule: "purchases", sourceId: r.id });

  const supPayConds = [];
  if (fromDate) supPayConds.push(sql`${supplierPaymentsTable.paymentDate} >= ${fromDate}`);
  if (toDate) supPayConds.push(sql`${supplierPaymentsTable.paymentDate} <= ${toDate}`);
  const suppPays = await db
    .select({ id: supplierPaymentsTable.id, paymentDate: supplierPaymentsTable.paymentDate, amountIqd: supplierPaymentsTable.amountIqd, supplierId: supplierPaymentsTable.supplierId })
    .from(supplierPaymentsTable)
    .where(supPayConds.length ? and(...supPayConds) : undefined);
  for (const r of suppPays) movements.push({ date: r.paymentDate, type: "پارەدانی دابینکار", direction: "out", amount: Number(r.amountIqd), description: `پارەدان بۆ دابینکار #${r.supplierId}`, sourceModule: "supplier-payments", sourceId: r.id });

  const expConds = [];
  if (fromDate) expConds.push(sql`${expensesTable.expenseDate} >= ${fromDate}`);
  if (toDate) expConds.push(sql`${expensesTable.expenseDate} <= ${toDate}`);
  const expenses = await db
    .select({ id: expensesTable.id, expenseDate: expensesTable.expenseDate, amount: expensesTable.amount, description: expensesTable.description, category: expensesTable.category })
    .from(expensesTable)
    .where(expConds.length ? and(...expConds) : undefined);
  for (const r of expenses) movements.push({ date: r.expenseDate, type: "خەرجی", direction: "out", amount: Number(r.amount), description: `${r.category}: ${r.description}`, sourceModule: "expenses", sourceId: r.id });

  const payConds = [sql`${payrollEntriesTable.paidAmount} > 0`];
  if (fromDate) payConds.push(sql`coalesce(${payrollEntriesTable.paymentDate}, ${payrollEntriesTable.period} || '-01') >= ${fromDate}`);
  if (toDate) payConds.push(sql`coalesce(${payrollEntriesTable.paymentDate}, ${payrollEntriesTable.period} || '-01') <= ${toDate}`);
  const payroll = await db
    .select({ id: payrollEntriesTable.id, paymentDate: payrollEntriesTable.paymentDate, period: payrollEntriesTable.period, paidAmount: payrollEntriesTable.paidAmount, employeeId: payrollEntriesTable.employeeId })
    .from(payrollEntriesTable)
    .where(and(...payConds));
  for (const r of payroll) movements.push({ date: r.paymentDate ?? `${r.period}-01`, type: "مووچە", direction: "out", amount: Number(r.paidAmount), description: `مووچەی ${r.period} بۆ کارمەند #${r.employeeId}`, sourceModule: "payroll", sourceId: r.id });

  const wdConds = [eq(shareholderTransactionsTable.type, "withdrawal")];
  if (fromDate) wdConds.push(sql`${shareholderTransactionsTable.transactionDate} >= ${fromDate}`);
  if (toDate) wdConds.push(sql`${shareholderTransactionsTable.transactionDate} <= ${toDate}`);
  const withdrawals = await db
    .select({ id: shareholderTransactionsTable.id, transactionDate: shareholderTransactionsTable.transactionDate, amount: shareholderTransactionsTable.amount, shareholderId: shareholderTransactionsTable.shareholderId })
    .from(shareholderTransactionsTable)
    .where(and(...wdConds));
  for (const r of withdrawals) movements.push({ date: r.transactionDate, type: "دەرکردنی شریک", direction: "out", amount: Number(r.amount), description: `دەرکردن بۆ شریک #${r.shareholderId}`, sourceModule: "shareholders", sourceId: r.id });

  movements.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  res.json(movements);
});

router.get("/cashbox/monthly-closings", async (_req, res): Promise<void> => {
  const rows = await db.select().from(monthlyClosingsTable).orderBy(desc(monthlyClosingsTable.year), desc(monthlyClosingsTable.month));
  res.json(rows.map(serializeClosing));
});

router.get("/cashbox/monthly-closings/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [closing] = await db.select().from(monthlyClosingsTable).where(eq(monthlyClosingsTable.id, id));
  if (!closing) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const dists = await db.select().from(profitDistributionsTable).where(eq(profitDistributionsTable.closingId, id));
  res.json({
    closing: serializeClosing(closing),
    distributions: dists.map((d) => ({
      ...d,
      sharePercentage: Number(d.sharePercentage),
      amount: Number(d.amount),
      paidAmount: Number(d.paidAmount),
    })),
  });
});

router.post("/cashbox/monthly-closings", async (req, res): Promise<void> => {
  const parsed = CreateMonthlyClosingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error });
    return;
  }
  const { year, month, notes } = parsed.data;
  const monthStr = String(month).padStart(2, "0");
  const prefix = `${year}-${monthStr}`;

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(monthlyClosingsTable).where(and(eq(monthlyClosingsTable.year, year), eq(monthlyClosingsTable.month, monthStr)));
    if (existing && existing.status === "closed") {
      return { conflict: true as const, id: existing.id };
    }

    const [salesAgg] = await tx.select({ total: sql<string>`coalesce(sum(total), 0)` }).from(salesInvoicesTable).where(and(eq(salesInvoicesTable.isDeleted, false), sql`invoice_date like ${prefix + "%"}`));
    const [purchAgg] = await tx.select({ total: sql<string>`coalesce(sum(total_iqd), 0)` }).from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.isDeleted, false), sql`invoice_date like ${prefix + "%"}`));
    const [expAgg] = await tx.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(expensesTable).where(sql`expense_date like ${prefix + "%"}`);
    const [payrollAgg] = await tx.select({ total: sql<string>`coalesce(sum(total_due), 0)` }).from(payrollEntriesTable).where(sql`period like ${prefix + "%"}`);
    const [incAgg] = await tx.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(incomesTable).where(sql`income_date like ${prefix + "%"}`);
    const [shrAgg] = await tx.select({ total: sql<string>`coalesce(sum(amount), 0)` }).from(shareholderTransactionsTable).where(and(eq(shareholderTransactionsTable.type, "withdrawal"), sql`transaction_date like ${prefix + "%"}`));
    const [salesCashAgg] = await tx.select({ total: sql<string>`coalesce(sum(paid_amount), 0)` }).from(salesInvoicesTable).where(and(eq(salesInvoicesTable.isDeleted, false), sql`invoice_date like ${prefix + "%"}`));
    const [purchCashAgg] = await tx.select({ total: sql<string>`coalesce(sum(paid_amount_iqd), 0)` }).from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.isDeleted, false), sql`invoice_date like ${prefix + "%"}`));

    const totalSales = Number(salesAgg.total);
    const totalPurchases = Number(purchAgg.total);
    const totalExpenses = Number(expAgg.total);
    const totalPayroll = Number(payrollAgg.total);
    const totalOtherIncome = Number(incAgg.total);
    const totalShareholderWithdrawals = Number(shrAgg.total);
    const grossProfit = totalSales - totalPurchases;
    const netProfit = grossProfit - totalExpenses - totalPayroll + totalOtherIncome;
    const cashIn = Number(salesCashAgg.total) + totalOtherIncome;
    const cashOut = Number(purchCashAgg.total) + totalExpenses + totalPayroll + totalShareholderWithdrawals;

    let closing;
    if (existing) {
      [closing] = await tx
        .update(monthlyClosingsTable)
        .set({
          status: "closed",
          totalSales: String(totalSales),
          totalPurchases: String(totalPurchases),
          totalExpenses: String(totalExpenses),
          totalPayroll: String(totalPayroll),
          totalOtherIncome: String(totalOtherIncome),
          totalShareholderWithdrawals: String(totalShareholderWithdrawals),
          grossProfit: String(grossProfit),
          netProfit: String(netProfit),
          cashIn: String(cashIn),
          cashOut: String(cashOut),
          notes: notes ?? null,
          closedAt: new Date(),
          reopenedAt: null,
        })
        .where(eq(monthlyClosingsTable.id, existing.id))
        .returning();
      await tx.delete(profitDistributionsTable).where(eq(profitDistributionsTable.closingId, existing.id));
    } else {
      [closing] = await tx
        .insert(monthlyClosingsTable)
        .values({
          year,
          month: monthStr,
          status: "closed",
          totalSales: String(totalSales),
          totalPurchases: String(totalPurchases),
          totalExpenses: String(totalExpenses),
          totalPayroll: String(totalPayroll),
          totalOtherIncome: String(totalOtherIncome),
          totalShareholderWithdrawals: String(totalShareholderWithdrawals),
          grossProfit: String(grossProfit),
          netProfit: String(netProfit),
          cashIn: String(cashIn),
          cashOut: String(cashOut),
          notes: notes ?? null,
        })
        .returning();
    }

    const shareholders = await tx.select().from(shareholdersTable).where(eq(shareholdersTable.isActive, true));
    const dists = [];
    if (shareholders.length > 0) {
      // Use integer-cent arithmetic so shares always sum exactly to netProfit
      const netCents = Math.round(netProfit * 100);
      const rawCents = shareholders.map((s) => Math.floor((netCents * Number(s.sharePercentage)) / 100));
      let remainder = netCents - rawCents.reduce((a, b) => a + b, 0);
      // Distribute the remainder one cent at a time to the largest-share shareholders first
      const order = shareholders
        .map((s, i) => ({ i, pct: Number(s.sharePercentage) }))
        .sort((a, b) => b.pct - a.pct);
      for (let k = 0; remainder > 0; k = (k + 1) % order.length) {
        rawCents[order[k].i] += 1;
        remainder -= 1;
      }
      const inserted = await tx
        .insert(profitDistributionsTable)
        .values(
          shareholders.map((s, i) => ({
            closingId: closing.id,
            shareholderId: s.id,
            shareholderName: s.name,
            sharePercentage: String(s.sharePercentage),
            amount: (rawCents[i] / 100).toFixed(2),
          })),
        )
        .returning();
      dists.push(...inserted);
    }
    return { conflict: false as const, closing, dists };
  }).catch((e: unknown) => {
    const err = e as { code?: string; constraint?: string };
    if (err?.code === "23505") {
      return { conflict: true as const, id: -1, raceConflict: true as const };
    }
    throw e;
  });

  if (result.conflict) {
    res.status(409).json({ error: "already_closed", id: result.id });
    return;
  }

  res.status(201).json({
    closing: serializeClosing(result.closing),
    distributions: result.dists.map((d) => ({
      ...d,
      sharePercentage: Number(d.sharePercentage),
      amount: Number(d.amount),
      paidAmount: Number(d.paidAmount),
    })),
  });
});

router.post("/cashbox/monthly-closings/:id/reopen", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [updated] = await db
    .update(monthlyClosingsTable)
    .set({ status: "open", reopenedAt: new Date() })
    .where(eq(monthlyClosingsTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json(serializeClosing(updated));
});

router.delete("/cashbox/monthly-closings/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(monthlyClosingsTable).where(eq(monthlyClosingsTable.id, id));
  res.status(204).end();
});

function serializeClosing(c: typeof monthlyClosingsTable.$inferSelect) {
  return {
    ...c,
    totalSales: Number(c.totalSales),
    totalPurchases: Number(c.totalPurchases),
    totalExpenses: Number(c.totalExpenses),
    totalPayroll: Number(c.totalPayroll),
    totalOtherIncome: Number(c.totalOtherIncome),
    totalShareholderWithdrawals: Number(c.totalShareholderWithdrawals),
    grossProfit: Number(c.grossProfit),
    netProfit: Number(c.netProfit),
    cashIn: Number(c.cashIn),
    cashOut: Number(c.cashOut),
    closedAt: c.closedAt.toISOString(),
    reopenedAt: c.reopenedAt ? c.reopenedAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

export default router;
