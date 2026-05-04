import { pgTable, text, serial, timestamp, numeric, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { suppliersTable } from "./suppliers";
import { materialsTable } from "./materials";
import { exchangeRatesTable } from "./exchange_rates";

export const purchaseInvoicesTable = pgTable("purchase_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "restrict" }),
  invoiceDate: text("invoice_date").notNull(),
  currency: text("currency").notNull().default("IQD"),
  exchangeRateId: integer("exchange_rate_id").references(() => exchangeRatesTable.id, { onDelete: "set null" }),
  exchangeRateValue: numeric("exchange_rate_value", { precision: 12, scale: 2 }),
  // Supplier snapshot (denormalized at invoice time)
  supplierMobile: text("supplier_mobile"),
  supplierAddress: text("supplier_address"),
  // Driver
  driver: text("driver"),
  driverMobile: text("driver_mobile"),
  vehicle: text("vehicle"),
  // Guarantor
  guarantorName: text("guarantor_name"),
  notes: text("notes"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
  subtotalIqd: numeric("subtotal_iqd", { precision: 15, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
  totalIqd: numeric("total_iqd", { precision: 15, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  paidAmountIqd: numeric("paid_amount_iqd", { precision: 15, scale: 2 }).notNull().default("0"),
  remainingDebt: numeric("remaining_debt", { precision: 15, scale: 2 }).notNull().default("0"),
  remainingDebtIqd: numeric("remaining_debt_iqd", { precision: 15, scale: 2 }).notNull().default("0"),
  // Old (carried-over) debt at invoice time (in invoice currency)
  previousDebt: numeric("previous_debt", { precision: 15, scale: 2 }).notNull().default("0"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  syncStatus: text("sync_status").notNull().default("local"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("purchase_invoices_supplier_idx").on(t.supplierId),
  index("purchase_invoices_date_idx").on(t.invoiceDate),
]);

export const purchaseInvoiceItemsTable = pgTable("purchase_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => purchaseInvoicesTable.id, { onDelete: "cascade" }),
  materialId: integer("material_id").references(() => materialsTable.id, { onDelete: "set null" }),
  materialName: text("material_name").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  palletCount: numeric("pallet_count", { precision: 10, scale: 2 }),
  bricksPerPallet: numeric("bricks_per_pallet", { precision: 10, scale: 2 }),
  totalBricks: numeric("total_bricks", { precision: 12, scale: 2 }),
  unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).notNull(),
  total: numeric("total", { precision: 15, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("purchase_invoice_items_invoice_idx").on(t.invoiceId),
]);

export const insertPurchaseInvoiceSchema = createInsertSchema(purchaseInvoicesTable).omit({ id: true, createdAt: true, updatedAt: true, syncStatus: true, deletedAt: true });
export type InsertPurchaseInvoice = z.infer<typeof insertPurchaseInvoiceSchema>;
export type PurchaseInvoice = typeof purchaseInvoicesTable.$inferSelect;
export type PurchaseInvoiceItem = typeof purchaseInvoiceItemsTable.$inferSelect;
