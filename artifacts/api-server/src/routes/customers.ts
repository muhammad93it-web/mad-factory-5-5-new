import { Router } from "express";
import { eq, and, isNull, ilike, or, sql } from "drizzle-orm";
import { db, customersTable, salesInvoicesTable, customerPaymentsTable } from "@workspace/db";
import {
  ListCustomersQueryParams,
  CreateCustomerBody,
  GetCustomerParams,
  UpdateCustomerParams,
  UpdateCustomerBody,
  DeleteCustomerParams,
  GetCustomerStatementParams,
  GetCustomerStatementQueryParams,
  SetCustomerOpeningBalanceParams,
  SetCustomerOpeningBalanceBody,
} from "@workspace/api-zod";

const router = Router();

router.get("/customers", async (req, res): Promise<void> => {
  const query = ListCustomersQueryParams.safeParse(req.query);
  const conditions = [isNull(customersTable.deletedAt)];
  if (query.success) {
    if (query.data.active !== undefined) {
      conditions.push(eq(customersTable.isActive, query.data.active));
    }
    if (query.data.search) {
      conditions.push(
        or(
          ilike(customersTable.name, `%${query.data.search}%`),
          ilike(customersTable.phone ?? sql`''`, `%${query.data.search}%`)
        )!
      );
    }
  }

  const customers = await db.select().from(customersTable).where(and(...conditions));

  const enriched = await Promise.all(
    customers.map(async (c) => {
      const [salesAgg] = await db
        .select({ totalDebt: sql<string>`coalesce(sum(remaining_debt), 0)` })
        .from(salesInvoicesTable)
        .where(and(eq(salesInvoicesTable.customerId, c.id), eq(salesInvoicesTable.isDeleted, false)));
      const [paidAgg] = await db
        .select({ totalPaid: sql<string>`coalesce(sum(amount), 0)` })
        .from(customerPaymentsTable)
        .where(eq(customerPaymentsTable.customerId, c.id));
      return {
        ...c,
        openingBalance: Number(c.openingBalance),
        totalDebt: Number(salesAgg.totalDebt),
        totalPaid: Number(paidAgg.totalPaid),
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    })
  );

  res.json(enriched);
});

router.post("/customers", async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [customer] = await db
    .insert(customersTable)
    .values({ ...parsed.data, openingBalance: String(parsed.data.openingBalance ?? 0) })
    .returning();
  res.status(201).json({
    ...customer,
    openingBalance: Number(customer.openingBalance),
    totalDebt: 0,
    totalPaid: 0,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  });
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const params = GetCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [customer] = await db.select().from(customersTable).where(and(eq(customersTable.id, params.data.id), isNull(customersTable.deletedAt)));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const [salesAgg] = await db
    .select({ totalDebt: sql<string>`coalesce(sum(remaining_debt), 0)` })
    .from(salesInvoicesTable)
    .where(and(eq(salesInvoicesTable.customerId, customer.id), eq(salesInvoicesTable.isDeleted, false)));
  const [paidAgg] = await db
    .select({ totalPaid: sql<string>`coalesce(sum(amount), 0)` })
    .from(customerPaymentsTable)
    .where(eq(customerPaymentsTable.customerId, customer.id));
  res.json({
    ...customer,
    openingBalance: Number(customer.openingBalance),
    totalDebt: Number(salesAgg.totalDebt),
    totalPaid: Number(paidAgg.totalPaid),
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  });
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const params = UpdateCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [customer] = await db
    .update(customersTable)
    .set(parsed.data)
    .where(eq(customersTable.id, params.data.id))
    .returning();
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json({
    ...customer,
    openingBalance: Number(customer.openingBalance),
    totalDebt: 0,
    totalPaid: 0,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  });
});

router.delete("/customers/:id", async (req, res): Promise<void> => {
  const params = DeleteCustomerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db
    .update(customersTable)
    .set({ deletedAt: new Date() })
    .where(eq(customersTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/customers/:id/statement", async (req, res): Promise<void> => {
  const params = GetCustomerStatementParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const qp = GetCustomerStatementQueryParams.safeParse(req.query);
  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, params.data.id));
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const invoiceConditions = [eq(salesInvoicesTable.customerId, params.data.id), eq(salesInvoicesTable.isDeleted, false)];
  const paymentConditions = [eq(customerPaymentsTable.customerId, params.data.id)];

  if (qp.success && qp.data.fromDate) {
    invoiceConditions.push(sql`invoice_date >= ${qp.data.fromDate}`);
    paymentConditions.push(sql`payment_date >= ${qp.data.fromDate}`);
  }
  if (qp.success && qp.data.toDate) {
    invoiceConditions.push(sql`invoice_date <= ${qp.data.toDate}`);
    paymentConditions.push(sql`payment_date <= ${qp.data.toDate}`);
  }

  const invoices = await db.select().from(salesInvoicesTable).where(and(...invoiceConditions));
  const payments = await db.select().from(customerPaymentsTable).where(and(...paymentConditions));

  const entries: {date: string; type: string; description: string; debit: number; credit: number; balance: number; referenceId: number | null}[] = [];
  const openingBalance = Number(customer.openingBalance);

  invoices.forEach((inv) => {
    entries.push({
      date: inv.invoiceDate,
      type: "invoice",
      description: `پسووڵەی فرۆشتن #${inv.invoiceNumber}`,
      debit: Number(inv.total),
      credit: Number(inv.paidAmount),
      balance: 0,
      referenceId: inv.id,
    });
  });

  payments.forEach((p) => {
    entries.push({
      date: p.paymentDate,
      type: "payment",
      description: `پارەدان`,
      debit: 0,
      credit: Number(p.amount),
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
    entityId: customer.id,
    entityName: customer.name,
    openingBalance,
    totalDebit,
    totalCredit,
    closingBalance: openingBalance + totalDebit - totalCredit,
    entries,
  });
});

router.post("/customers/:id/opening-balance", async (req, res): Promise<void> => {
  const params = SetCustomerOpeningBalanceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SetCustomerOpeningBalanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.update(customersTable).set({ openingBalance: String(parsed.data.amount) }).where(eq(customersTable.id, params.data.id));
  res.json({ success: true });
});

export default router;
