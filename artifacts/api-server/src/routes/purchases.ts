import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, purchaseInvoicesTable, purchaseInvoiceItemsTable, suppliersTable, exchangeRatesTable } from "@workspace/db";
import {
  ListPurchaseInvoicesQueryParams,
  CreatePurchaseInvoiceBody,
  GetPurchaseInvoiceParams,
  UpdatePurchaseInvoiceParams,
  UpdatePurchaseInvoiceBody,
  DeletePurchaseInvoiceParams,
  GetDailyPurchasesReportQueryParams,
} from "@workspace/api-zod";

const router = Router();

function mapInvoice(inv: typeof purchaseInvoicesTable.$inferSelect & { supplierName?: string }) {
  return {
    ...inv,
    supplierName: inv.supplierName ?? "",
    exchangeRateValue: inv.exchangeRateValue != null ? Number(inv.exchangeRateValue) : null,
    subtotal: Number(inv.subtotal),
    subtotalIqd: Number(inv.subtotalIqd),
    discount: Number(inv.discount),
    total: Number(inv.total),
    totalIqd: Number(inv.totalIqd),
    paidAmount: Number(inv.paidAmount),
    paidAmountIqd: Number(inv.paidAmountIqd),
    previousDebt: Number(inv.previousDebt),
    remainingDebt: Number(inv.remainingDebt),
    remainingDebtIqd: Number(inv.remainingDebtIqd),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

async function genPurchaseInvoiceNumber(): Promise<string> {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(purchaseInvoicesTable);
  const num = (Number(row.count) + 1).toString().padStart(5, "0");
  return `PUR-${num}`;
}

router.get("/purchases", async (req, res): Promise<void> => {
  const qp = ListPurchaseInvoicesQueryParams.safeParse(req.query);
  const conditions = [eq(purchaseInvoicesTable.isDeleted, false)];
  if (qp.success) {
    if (qp.data.supplierId) conditions.push(eq(purchaseInvoicesTable.supplierId, qp.data.supplierId));
    if (qp.data.fromDate) conditions.push(sql`invoice_date >= ${qp.data.fromDate}` as ReturnType<typeof eq>);
    if (qp.data.toDate) conditions.push(sql`invoice_date <= ${qp.data.toDate}` as ReturnType<typeof eq>);
    if (qp.data.currency) conditions.push(eq(purchaseInvoicesTable.currency, qp.data.currency));
  }

  const invoices = await db
    .select({ inv: purchaseInvoicesTable, supplierName: suppliersTable.name })
    .from(purchaseInvoicesTable)
    .leftJoin(suppliersTable, eq(purchaseInvoicesTable.supplierId, suppliersTable.id))
    .where(and(...conditions))
    .orderBy(desc(purchaseInvoicesTable.invoiceDate));

  res.json(invoices.map(({ inv, supplierName }) => mapInvoice({ ...inv, supplierName: supplierName ?? "" })));
});

router.post("/purchases", async (req, res): Promise<void> => {
  const parsed = CreatePurchaseInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let exchangeRateValue = 1;
  if (parsed.data.currency === "USD" && parsed.data.exchangeRateId) {
    const [rate] = await db.select().from(exchangeRatesTable).where(eq(exchangeRatesTable.id, parsed.data.exchangeRateId));
    if (rate) exchangeRateValue = Number(rate.rate);
  }

  const items = parsed.data.items ?? [];
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const subtotalIqd = subtotal * exchangeRateValue;
  const discount = parsed.data.discount ?? 0;
  const total = subtotal - discount;
  const totalIqd = total * exchangeRateValue;
  const paidAmount = parsed.data.paidAmount ?? 0;
  const paidAmountIqd = paidAmount * exchangeRateValue;
  const previousDebt = parsed.data.previousDebt ?? 0;
  const remainingDebt = total + previousDebt - paidAmount;
  const remainingDebtIqd = remainingDebt * exchangeRateValue;
  const invoiceNumber = await genPurchaseInvoiceNumber();

  const [inv] = await db.insert(purchaseInvoicesTable).values({
    invoiceNumber,
    supplierId: parsed.data.supplierId,
    invoiceDate: parsed.data.invoiceDate,
    supplierMobile: parsed.data.supplierMobile,
    supplierAddress: parsed.data.supplierAddress,
    driver: parsed.data.driver,
    driverMobile: parsed.data.driverMobile,
    vehicle: parsed.data.vehicle,
    guarantorName: parsed.data.guarantorName,
    currency: parsed.data.currency,
    exchangeRateId: parsed.data.exchangeRateId ?? null,
    exchangeRateValue: String(exchangeRateValue),
    notes: parsed.data.notes,
    subtotal: String(subtotal),
    subtotalIqd: String(subtotalIqd),
    discount: String(discount),
    total: String(total),
    totalIqd: String(totalIqd),
    paidAmount: String(paidAmount),
    paidAmountIqd: String(paidAmountIqd),
    previousDebt: String(previousDebt),
    remainingDebt: String(remainingDebt),
    remainingDebtIqd: String(remainingDebtIqd),
  }).returning();

  if (items.length > 0) {
    await db.insert(purchaseInvoiceItemsTable).values(items.map((item) => ({
      invoiceId: inv.id,
      materialId: item.materialId ?? null,
      materialName: item.materialName,
      quantity: String(item.quantity),
      palletCount: item.palletCount != null ? String(item.palletCount) : null,
      bricksPerPallet: item.bricksPerPallet != null ? String(item.bricksPerPallet) : null,
      totalBricks: item.totalBricks != null ? String(item.totalBricks) : null,
      unitPrice: String(item.unitPrice),
      total: String(item.quantity * item.unitPrice),
      notes: item.notes,
    })));
  }

  const [supplier] = await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, parsed.data.supplierId));
  res.status(201).json(mapInvoice({ ...inv, supplierName: supplier?.name ?? "" }));
});

router.get("/purchases/daily-report", async (req, res): Promise<void> => {
  const qp = GetDailyPurchasesReportQueryParams.safeParse(req.query);
  const date = (qp.success && qp.data.date) ? qp.data.date : new Date().toISOString().split("T")[0];

  const invoices = await db
    .select({ inv: purchaseInvoicesTable, supplierName: suppliersTable.name })
    .from(purchaseInvoicesTable)
    .leftJoin(suppliersTable, eq(purchaseInvoicesTable.supplierId, suppliersTable.id))
    .where(and(eq(purchaseInvoicesTable.isDeleted, false), sql`invoice_date = ${date}`));

  const totalAmount = invoices.reduce((s, { inv }) => s + Number(inv.totalIqd), 0);
  const totalPaid = invoices.reduce((s, { inv }) => s + Number(inv.paidAmountIqd), 0);
  const totalDebt = invoices.reduce((s, { inv }) => s + Number(inv.remainingDebtIqd), 0);

  res.json({
    date,
    totalInvoices: invoices.length,
    totalAmount,
    totalPaid,
    totalDebt,
    invoices: invoices.map(({ inv, supplierName }) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      entityName: supplierName ?? "",
      total: Number(inv.totalIqd),
      paidAmount: Number(inv.paidAmountIqd),
      remainingDebt: Number(inv.remainingDebtIqd),
    })),
  });
});

router.get("/purchases/:id", async (req, res): Promise<void> => {
  const params = GetPurchaseInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ inv: purchaseInvoicesTable, supplierName: suppliersTable.name })
    .from(purchaseInvoicesTable)
    .leftJoin(suppliersTable, eq(purchaseInvoicesTable.supplierId, suppliersTable.id))
    .where(eq(purchaseInvoicesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  const items = await db.select().from(purchaseInvoiceItemsTable).where(eq(purchaseInvoiceItemsTable.invoiceId, params.data.id));
  res.json({
    ...mapInvoice({ ...row.inv, supplierName: row.supplierName ?? "" }),
    items: items.map((i) => ({
      id: i.id,
      materialId: i.materialId,
      materialName: i.materialName,
      quantity: Number(i.quantity),
      palletCount: i.palletCount != null ? Number(i.palletCount) : null,
      bricksPerPallet: i.bricksPerPallet != null ? Number(i.bricksPerPallet) : null,
      totalBricks: i.totalBricks != null ? Number(i.totalBricks) : null,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
      notes: i.notes,
    })),
  });
});

router.patch("/purchases/:id", async (req, res): Promise<void> => {
  const params = UpdatePurchaseInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePurchaseInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(purchaseInvoicesTable).where(eq(purchaseInvoicesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const rateValue = Number(existing.exchangeRateValue ?? 1);
  const updateData: Record<string, unknown> = {};
  if (parsed.data.invoiceDate) updateData.invoiceDate = parsed.data.invoiceDate;
  if (parsed.data.supplierMobile !== undefined) updateData.supplierMobile = parsed.data.supplierMobile;
  if (parsed.data.supplierAddress !== undefined) updateData.supplierAddress = parsed.data.supplierAddress;
  if (parsed.data.driver !== undefined) updateData.driver = parsed.data.driver;
  if (parsed.data.driverMobile !== undefined) updateData.driverMobile = parsed.data.driverMobile;
  if (parsed.data.vehicle !== undefined) updateData.vehicle = parsed.data.vehicle;
  if (parsed.data.guarantorName !== undefined) updateData.guarantorName = parsed.data.guarantorName;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.previousDebt !== undefined) updateData.previousDebt = String(parsed.data.previousDebt);

  const previousDebt = parsed.data.previousDebt ?? Number(existing.previousDebt ?? 0);

  if (parsed.data.items) {
    const items = parsed.data.items;
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const discount = parsed.data.discount ?? 0;
    const total = subtotal - discount;
    const paidAmount = parsed.data.paidAmount ?? 0;
    const remaining = total + previousDebt - paidAmount;
    updateData.subtotal = String(subtotal);
    updateData.subtotalIqd = String(subtotal * rateValue);
    updateData.discount = String(discount);
    updateData.total = String(total);
    updateData.totalIqd = String(total * rateValue);
    updateData.paidAmount = String(paidAmount);
    updateData.paidAmountIqd = String(paidAmount * rateValue);
    updateData.remainingDebt = String(remaining);
    updateData.remainingDebtIqd = String(remaining * rateValue);
    await db.delete(purchaseInvoiceItemsTable).where(eq(purchaseInvoiceItemsTable.invoiceId, params.data.id));
    await db.insert(purchaseInvoiceItemsTable).values(items.map((item) => ({
      invoiceId: params.data.id,
      materialId: item.materialId ?? null,
      materialName: item.materialName,
      quantity: String(item.quantity),
      palletCount: item.palletCount != null ? String(item.palletCount) : null,
      bricksPerPallet: item.bricksPerPallet != null ? String(item.bricksPerPallet) : null,
      totalBricks: item.totalBricks != null ? String(item.totalBricks) : null,
      unitPrice: String(item.unitPrice),
      total: String(item.quantity * item.unitPrice),
      notes: item.notes,
    })));
  } else if (parsed.data.discount !== undefined || parsed.data.paidAmount !== undefined || parsed.data.previousDebt !== undefined) {
    const discount = parsed.data.discount ?? Number(existing.discount);
    const paidAmount = parsed.data.paidAmount ?? Number(existing.paidAmount);
    const total = Number(existing.subtotal) - discount;
    const remaining = total + previousDebt - paidAmount;
    updateData.discount = String(discount);
    updateData.total = String(total);
    updateData.totalIqd = String(total * rateValue);
    updateData.paidAmount = String(paidAmount);
    updateData.paidAmountIqd = String(paidAmount * rateValue);
    updateData.remainingDebt = String(remaining);
    updateData.remainingDebtIqd = String(remaining * rateValue);
  }

  const [inv] = Object.keys(updateData).length > 0
    ? await db.update(purchaseInvoicesTable).set(updateData).where(eq(purchaseInvoicesTable.id, params.data.id)).returning()
    : [existing];
  const [supplier] = await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, inv.supplierId));
  res.json(mapInvoice({ ...inv, supplierName: supplier?.name ?? "" }));
});

router.delete("/purchases/:id", async (req, res): Promise<void> => {
  const params = DeletePurchaseInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(purchaseInvoicesTable).set({ isDeleted: true, deletedAt: new Date() }).where(eq(purchaseInvoicesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
