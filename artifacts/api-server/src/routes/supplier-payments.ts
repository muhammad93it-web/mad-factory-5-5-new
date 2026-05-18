import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, supplierPaymentsTable, suppliersTable, exchangeRatesTable } from "@workspace/db";
import {
  ListSupplierPaymentsQueryParams,
  CreateSupplierPaymentBody,
  GetSupplierPaymentParams,
  DeleteSupplierPaymentParams,
} from "@workspace/api-zod";

const router = Router();

function mapPayment(p: typeof supplierPaymentsTable.$inferSelect & { supplierName?: string }) {
  return {
    ...p,
    supplierName: p.supplierName ?? "",
    amount: Number(p.amount),
    amountIqd: Number(p.amountIqd),
    exchangeRateValue: p.exchangeRateValue != null ? Number(p.exchangeRateValue) : null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/supplier-payments", async (req, res): Promise<void> => {
  const qp = ListSupplierPaymentsQueryParams.safeParse(req.query);
  const conditions: ReturnType<typeof eq>[] = [];
  if (qp.success) {
    if (qp.data.supplierId) conditions.push(eq(supplierPaymentsTable.supplierId, qp.data.supplierId));
    if (qp.data.fromDate) conditions.push(sql`payment_date >= ${qp.data.fromDate}` as ReturnType<typeof eq>);
    if (qp.data.toDate) conditions.push(sql`payment_date <= ${qp.data.toDate}` as ReturnType<typeof eq>);
  }

  const payments = await db
    .select({ p: supplierPaymentsTable, supplierName: suppliersTable.name })
    .from(supplierPaymentsTable)
    .leftJoin(suppliersTable, eq(supplierPaymentsTable.supplierId, suppliersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(supplierPaymentsTable.paymentDate));

  res.json(payments.map(({ p, supplierName }) => mapPayment({ ...p, supplierName: supplierName ?? "" })));
});

router.post("/supplier-payments", async (req, res): Promise<void> => {
  const parsed = CreateSupplierPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let amountIqd = parsed.data.amount;
  let exchangeRateValue: number | null = null;
  if (parsed.data.currency === "USD" && parsed.data.exchangeRateId) {
    const [rate] = await db.select().from(exchangeRatesTable).where(eq(exchangeRatesTable.id, parsed.data.exchangeRateId));
    if (rate) {
      exchangeRateValue = Number(rate.rate);
      amountIqd = parsed.data.amount * exchangeRateValue;
    }
  }

  const [p] = await db.insert(supplierPaymentsTable).values({
    ...parsed.data,
    amount: String(parsed.data.amount),
    amountIqd: String(amountIqd),
    exchangeRateValue: exchangeRateValue != null ? String(exchangeRateValue) : null,
  }).returning();

  const [supplier] = await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, parsed.data.supplierId));
  res.status(201).json(mapPayment({ ...p, supplierName: supplier?.name ?? "" }));
});

router.get("/supplier-payments/:id", async (req, res): Promise<void> => {
  const params = GetSupplierPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ p: supplierPaymentsTable, supplierName: suppliersTable.name })
    .from(supplierPaymentsTable)
    .leftJoin(suppliersTable, eq(supplierPaymentsTable.supplierId, suppliersTable.id))
    .where(eq(supplierPaymentsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  res.json(mapPayment({ ...row.p, supplierName: row.supplierName ?? "" }));
});

router.delete("/supplier-payments/:id", async (req, res): Promise<void> => {
  const params = DeleteSupplierPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(supplierPaymentsTable).where(eq(supplierPaymentsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
