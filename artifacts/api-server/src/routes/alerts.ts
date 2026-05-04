import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, salesInvoicesTable, purchaseInvoicesTable, customersTable, suppliersTable } from "@workspace/db";

const router = Router();

router.get("/alerts/overdue", async (req, res): Promise<void> => {
  const customerDebts = await db
    .select({
      customerId: salesInvoicesTable.customerId,
      customerName: customersTable.name,
      totalDebt: sql<string>`sum(remaining_debt)`,
      oldestDate: sql<string>`min(invoice_date)`,
      invoiceCount: sql<number>`count(*)`,
    })
    .from(salesInvoicesTable)
    .leftJoin(customersTable, eq(salesInvoicesTable.customerId, customersTable.id))
    .where(and(eq(salesInvoicesTable.isDeleted, false), sql`remaining_debt > 0`))
    .groupBy(salesInvoicesTable.customerId, customersTable.name)
    .having(sql`sum(remaining_debt) > 0`);

  const supplierDebts = await db
    .select({
      supplierId: purchaseInvoicesTable.supplierId,
      supplierName: suppliersTable.name,
      totalDebt: sql<string>`sum(remaining_debt_iqd)`,
      oldestDate: sql<string>`min(invoice_date)`,
      invoiceCount: sql<number>`count(*)`,
    })
    .from(purchaseInvoicesTable)
    .leftJoin(suppliersTable, eq(purchaseInvoicesTable.supplierId, suppliersTable.id))
    .where(and(eq(purchaseInvoicesTable.isDeleted, false), sql`remaining_debt_iqd > 0`))
    .groupBy(purchaseInvoicesTable.supplierId, suppliersTable.name)
    .having(sql`sum(remaining_debt_iqd) > 0`);

  const alerts = [
    ...customerDebts.map((d) => ({
      type: "customer",
      entityId: d.customerId,
      entityName: d.customerName ?? "",
      totalDebt: Number(d.totalDebt),
      oldestInvoiceDate: d.oldestDate ?? null,
      invoiceCount: Number(d.invoiceCount),
    })),
    ...supplierDebts.map((d) => ({
      type: "supplier",
      entityId: d.supplierId,
      entityName: d.supplierName ?? "",
      totalDebt: Number(d.totalDebt),
      oldestInvoiceDate: d.oldestDate ?? null,
      invoiceCount: Number(d.invoiceCount),
    })),
  ].sort((a, b) => b.totalDebt - a.totalDebt);

  res.json(alerts);
});

export default router;
