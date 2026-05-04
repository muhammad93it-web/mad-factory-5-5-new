import { pgTable, text, serial, timestamp, numeric, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { materialsTable } from "./materials";

export const salesInvoicesTable = pgTable("sales_invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "restrict" }),
  invoiceDate: text("invoice_date").notNull(),
  // Customer snapshot (denormalized at invoice time)
  customerMobile: text("customer_mobile"),
  customerAddress: text("customer_address"),
  // Driver
  driver: text("driver"),
  driverMobile: text("driver_mobile"),
  vehicle: text("vehicle"),
  // Guarantor
  guarantorName: text("guarantor_name"),
  notes: text("notes"),
  subtotal: numeric("subtotal", { precision: 15, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 15, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 15, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  remainingDebt: numeric("remaining_debt", { precision: 15, scale: 2 }).notNull().default("0"),
  // Old (carried-over) debt at invoice time
  previousDebt: numeric("previous_debt", { precision: 15, scale: 2 }).notNull().default("0"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  syncStatus: text("sync_status").notNull().default("local"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("sales_invoices_customer_idx").on(t.customerId),
  index("sales_invoices_date_idx").on(t.invoiceDate),
]);

export const salesInvoiceItemsTable = pgTable("sales_invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => salesInvoicesTable.id, { onDelete: "cascade" }),
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
  index("sales_invoice_items_invoice_idx").on(t.invoiceId),
]);

export const insertSalesInvoiceSchema = createInsertSchema(salesInvoicesTable).omit({ id: true, createdAt: true, updatedAt: true, syncStatus: true, deletedAt: true });
export type InsertSalesInvoice = z.infer<typeof insertSalesInvoiceSchema>;
export type SalesInvoice = typeof salesInvoicesTable.$inferSelect;
export type SalesInvoiceItem = typeof salesInvoiceItemsTable.$inferSelect;
