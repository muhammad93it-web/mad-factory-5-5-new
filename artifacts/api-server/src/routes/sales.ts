import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, salesInvoicesTable, salesInvoiceItemsTable, customersTable } from "@workspace/db";
import {
  ListSalesInvoicesQueryParams,
  CreateSalesInvoiceBody,
  GetSalesInvoiceParams,
  UpdateSalesInvoiceParams,
  UpdateSalesInvoiceBody,
  DeleteSalesInvoiceParams,
  GetDailySalesReportQueryParams,
} from "@workspace/api-zod";

const router = Router();

function mapInvoice(inv: typeof salesInvoicesTable.$inferSelect & { customerName?: string }) {
  return {
    ...inv,
    customerName: inv.customerName ?? "",
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    total: Number(inv.total),
    paidAmount: Number(inv.paidAmount),
    previousDebt: Number(inv.previousDebt),
    remainingDebt: Number(inv.remainingDebt),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

async function genInvoiceNumber(): Promise<string> {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(salesInvoicesTable);
  const num = (Number(row.count) + 1).toString().padStart(5, "0");
  return `INV-${num}`;
}

router.get("/sales", async (req, res): Promise<void> => {
  const qp = ListSalesInvoicesQueryParams.safeParse(req.query);
  const conditions = [eq(salesInvoicesTable.isDeleted, false)];
  if (qp.success) {
    if (qp.data.customerId) conditions.push(eq(salesInvoicesTable.customerId, qp.data.customerId));
    if (qp.data.fromDate) conditions.push(sql`invoice_date >= ${qp.data.fromDate}`);
    if (qp.data.toDate) conditions.push(sql`invoice_date <= ${qp.data.toDate}`);
  }

  const invoices = await db
    .select({ inv: salesInvoicesTable, customerName: customersTable.name })
    .from(salesInvoicesTable)
    .leftJoin(customersTable, eq(salesInvoicesTable.customerId, customersTable.id))
    .where(and(...conditions))
    .orderBy(desc(salesInvoicesTable.invoiceDate));

  res.json(invoices.map(({ inv, customerName }) => mapInvoice({ ...inv, customerName: customerName ?? "" })));
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSalesInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const items = parsed.data.items ?? [];
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discount = parsed.data.discount ?? 0;
  const total = subtotal - discount;
  const paidAmount = parsed.data.paidAmount ?? 0;
  const previousDebt = parsed.data.previousDebt ?? 0;
  const remainingDebt = total + previousDebt - paidAmount;

  const invoiceNumber = await genInvoiceNumber();

  const [inv] = await db.insert(salesInvoicesTable).values({
    invoiceNumber,
    customerId: parsed.data.customerId,
    invoiceDate: parsed.data.invoiceDate,
    customerMobile: parsed.data.customerMobile,
    customerAddress: parsed.data.customerAddress,
    driver: parsed.data.driver,
    driverMobile: parsed.data.driverMobile,
    vehicle: parsed.data.vehicle,
    guarantorName: parsed.data.guarantorName,
    notes: parsed.data.notes,
    subtotal: String(subtotal),
    discount: String(discount),
    total: String(total),
    paidAmount: String(paidAmount),
    previousDebt: String(previousDebt),
    remainingDebt: String(remainingDebt),
  }).returning();

  if (items.length > 0) {
    await db.insert(salesInvoiceItemsTable).values(
      items.map((item) => ({
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
      }))
    );
  }

  const [customer] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, parsed.data.customerId));
  res.status(201).json(mapInvoice({ ...inv, customerName: customer?.name ?? "" }));
});

router.get("/sales/daily-report", async (req, res): Promise<void> => {
  const qp = GetDailySalesReportQueryParams.safeParse(req.query);
  const date = (qp.success && qp.data.date) ? qp.data.date : new Date().toISOString().split("T")[0];

  const invoices = await db
    .select({ inv: salesInvoicesTable, customerName: customersTable.name })
    .from(salesInvoicesTable)
    .leftJoin(customersTable, eq(salesInvoicesTable.customerId, customersTable.id))
    .where(and(eq(salesInvoicesTable.isDeleted, false), sql`invoice_date = ${date}`));

  const totalAmount = invoices.reduce((s, { inv }) => s + Number(inv.total), 0);
  const totalPaid = invoices.reduce((s, { inv }) => s + Number(inv.paidAmount), 0);
  const totalDebt = invoices.reduce((s, { inv }) => s + Number(inv.remainingDebt), 0);

  res.json({
    date,
    totalInvoices: invoices.length,
    totalAmount,
    totalPaid,
    totalDebt,
    invoices: invoices.map(({ inv, customerName }) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      entityName: customerName ?? "",
      total: Number(inv.total),
      paidAmount: Number(inv.paidAmount),
      remainingDebt: Number(inv.remainingDebt),
    })),
  });
});

router.get("/sales/:id", async (req, res): Promise<void> => {
  const params = GetSalesInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ inv: salesInvoicesTable, customerName: customersTable.name })
    .from(salesInvoicesTable)
    .leftJoin(customersTable, eq(salesInvoicesTable.customerId, customersTable.id))
    .where(eq(salesInvoicesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }
  const items = await db.select().from(salesInvoiceItemsTable).where(eq(salesInvoiceItemsTable.invoiceId, params.data.id));
  res.json({
    ...mapInvoice({ ...row.inv, customerName: row.customerName ?? "" }),
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

router.patch("/sales/:id", async (req, res): Promise<void> => {
  const params = UpdateSalesInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSalesInvoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(salesInvoicesTable).where(eq(salesInvoicesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Invoice not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.invoiceDate) updateData.invoiceDate = parsed.data.invoiceDate;
  if (parsed.data.customerMobile !== undefined) updateData.customerMobile = parsed.data.customerMobile;
  if (parsed.data.customerAddress !== undefined) updateData.customerAddress = parsed.data.customerAddress;
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
    updateData.subtotal = String(subtotal);
    updateData.discount = String(discount);
    updateData.total = String(total);
    updateData.paidAmount = String(paidAmount);
    updateData.remainingDebt = String(total + previousDebt - paidAmount);
    await db.delete(salesInvoiceItemsTable).where(eq(salesInvoiceItemsTable.invoiceId, params.data.id));
    if (items.length > 0) {
      await db.insert(salesInvoiceItemsTable).values(items.map((item) => ({
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
    }
  } else if (parsed.data.discount !== undefined || parsed.data.paidAmount !== undefined || parsed.data.previousDebt !== undefined) {
    const discount = parsed.data.discount ?? Number(existing.discount);
    const paidAmount = parsed.data.paidAmount ?? Number(existing.paidAmount);
    const total = Number(existing.subtotal) - discount;
    updateData.discount = String(discount);
    updateData.paidAmount = String(paidAmount);
    updateData.total = String(total);
    updateData.remainingDebt = String(total + previousDebt - paidAmount);
  }

  const [inv] = Object.keys(updateData).length > 0
    ? await db.update(salesInvoicesTable).set(updateData).where(eq(salesInvoicesTable.id, params.data.id)).returning()
    : [existing];
  const [customer] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, inv.customerId));
  res.json(mapInvoice({ ...inv, customerName: customer?.name ?? "" }));
});

router.delete("/sales/:id", async (req, res): Promise<void> => {
  const params = DeleteSalesInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(salesInvoicesTable).set({ isDeleted: true, deletedAt: new Date() }).where(eq(salesInvoicesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
