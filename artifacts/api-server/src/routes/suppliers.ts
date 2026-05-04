import { Router } from "express";
import { eq, and, isNull, ilike, or, sql } from "drizzle-orm";
import { db, suppliersTable, purchaseInvoicesTable, supplierPaymentsTable } from "@workspace/db";
import {
  ListSuppliersQueryParams,
  CreateSupplierBody,
  GetSupplierParams,
  UpdateSupplierParams,
  UpdateSupplierBody,
  DeleteSupplierParams,
  GetSupplierStatementParams,
  GetSupplierStatementQueryParams,
  SetSupplierOpeningBalanceParams,
  SetSupplierOpeningBalanceBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/suppliers", async (req, res): Promise<void> => {
  const query = ListSuppliersQueryParams.safeParse(req.query);
  const conditions = [isNull(suppliersTable.deletedAt)];
  if (query.success && query.data.search) {
    conditions.push(
      or(ilike(suppliersTable.name, `%${query.data.search}%`))!
    );
  }

  const suppliers = await db.select().from(suppliersTable).where(and(...conditions));

  const enriched = await Promise.all(
    suppliers.map(async (s) => {
      const [debtAgg] = await db
        .select({ totalDebt: sql<string>`coalesce(sum(remaining_debt_iqd), 0)` })
        .from(purchaseInvoicesTable)
        .where(and(eq(purchaseInvoicesTable.supplierId, s.id), eq(purchaseInvoicesTable.isDeleted, false)));
      const [paidAgg] = await db
        .select({ totalPaid: sql<string>`coalesce(sum(amount_iqd), 0)` })
        .from(supplierPaymentsTable)
        .where(eq(supplierPaymentsTable.supplierId, s.id));
      return {
        ...s,
        openingBalance: Number(s.openingBalance),
        totalDebt: Number(debtAgg.totalDebt),
        totalPaid: Number(paidAgg.totalPaid),
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    })
  );
  res.json(enriched);
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [supplier] = await db.insert(suppliersTable).values({ ...parsed.data, openingBalance: String(parsed.data.openingBalance ?? 0) }).returning();
  res.status(201).json({ ...supplier, openingBalance: Number(supplier.openingBalance), totalDebt: 0, totalPaid: 0, createdAt: supplier.createdAt.toISOString(), updatedAt: supplier.updatedAt.toISOString() });
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const params = GetSupplierParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, params.data.id));
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  const [debtAgg] = await db.select({ totalDebt: sql<string>`coalesce(sum(remaining_debt_iqd), 0)` }).from(purchaseInvoicesTable).where(and(eq(purchaseInvoicesTable.supplierId, supplier.id), eq(purchaseInvoicesTable.isDeleted, false)));
  const [paidAgg] = await db.select({ totalPaid: sql<string>`coalesce(sum(amount_iqd), 0)` }).from(supplierPaymentsTable).where(eq(supplierPaymentsTable.supplierId, supplier.id));
  res.json({ ...supplier, openingBalance: Number(supplier.openingBalance), totalDebt: Number(debtAgg.totalDebt), totalPaid: Number(paidAgg.totalPaid), createdAt: supplier.createdAt.toISOString(), updatedAt: supplier.updatedAt.toISOString() });
});

router.patch("/suppliers/:id", async (req, res): Promise<void> => {
  const params = UpdateSupplierParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [supplier] = await db.update(suppliersTable).set(parsed.data).where(eq(suppliersTable.id, params.data.id)).returning();
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json({ ...supplier, openingBalance: Number(supplier.openingBalance), totalDebt: 0, totalPaid: 0, createdAt: supplier.createdAt.toISOString(), updatedAt: supplier.updatedAt.toISOString() });
});

router.delete("/suppliers/:id", async (req, res): Promise<void> => {
  const params = DeleteSupplierParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(suppliersTable).set({ deletedAt: new Date() }).where(eq(suppliersTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/suppliers/:id/statement", async (req, res): Promise<void> => {
  const params = GetSupplierStatementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const qp = GetSupplierStatementQueryParams.safeParse(req.query);
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, params.data.id));
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  const invCond = [eq(purchaseInvoicesTable.supplierId, params.data.id), eq(purchaseInvoicesTable.isDeleted, false)];
  const payCond = [eq(supplierPaymentsTable.supplierId, params.data.id)];
  if (qp.success && qp.data.fromDate) {
    invCond.push(sql`invoice_date >= ${qp.data.fromDate}`);
    payCond.push(sql`payment_date >= ${qp.data.fromDate}`);
  }
  if (qp.success && qp.data.toDate) {
    invCond.push(sql`invoice_date <= ${qp.data.toDate}`);
    payCond.push(sql`payment_date <= ${qp.data.toDate}`);
  }

  const invoices = await db.select().from(purchaseInvoicesTable).where(and(...invCond));
  const payments = await db.select().from(supplierPaymentsTable).where(and(...payCond));

  const entries: {date: string; type: string; description: string; debit: number; credit: number; balance: number; referenceId: number | null}[] = [];
  const openingBalance = Number(supplier.openingBalance);

  invoices.forEach((inv) => {
    entries.push({
      date: inv.invoiceDate,
      type: "invoice",
      description: `پسووڵەی کڕین #${inv.invoiceNumber}`,
      debit: Number(inv.totalIqd),
      credit: Number(inv.paidAmountIqd),
      balance: 0,
      referenceId: inv.id,
    });
  });

  payments.forEach((p) => {
    entries.push({
      date: p.paymentDate,
      type: "payment",
      description: `پارەدان بۆ دابینکار`,
      debit: 0,
      credit: Number(p.amountIqd),
      balance: 0,
      referenceId: p.id,
    });
  });

  entries.sort((a, b) => a.date.localeCompare(b.date));
  let balance = openingBalance;
  entries.forEach((e) => {
    balance += e.debit - e.credit;
    e.balance = balance;
  });

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  res.json({
    entityId: supplier.id,
    entityName: supplier.name,
    openingBalance,
    totalDebit,
    totalCredit,
    closingBalance: openingBalance + totalDebit - totalCredit,
    entries,
  });
});

router.post("/suppliers/:id/opening-balance", async (req, res): Promise<void> => {
  const params = SetSupplierOpeningBalanceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SetSupplierOpeningBalanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.update(suppliersTable).set({ openingBalance: String(parsed.data.amount) }).where(eq(suppliersTable.id, params.data.id));
  res.json({ success: true });
});

export default router;
