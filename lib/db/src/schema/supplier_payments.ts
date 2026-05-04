import { pgTable, text, serial, timestamp, numeric, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { suppliersTable } from "./suppliers";
import { exchangeRatesTable } from "./exchange_rates";

export const supplierPaymentsTable = pgTable("supplier_payments", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => suppliersTable.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("IQD"),
  exchangeRateId: integer("exchange_rate_id").references(() => exchangeRatesTable.id, { onDelete: "set null" }),
  amountIqd: numeric("amount_iqd", { precision: 15, scale: 2 }).notNull(),
  paymentDate: text("payment_date").notNull(),
  // Voucher type: "cash" (وەصڵ پارە قبض — direct cash payment) | "internal" (وەرگرتن ناو وەصڵ — internal voucher)
  voucherType: text("voucher_type").notNull().default("cash"),
  notes: text("notes"),
  syncStatus: text("sync_status").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("supplier_payments_supplier_idx").on(t.supplierId),
  index("supplier_payments_date_idx").on(t.paymentDate),
]);

export const insertSupplierPaymentSchema = createInsertSchema(supplierPaymentsTable).omit({ id: true, createdAt: true, syncStatus: true });
export type InsertSupplierPayment = z.infer<typeof insertSupplierPaymentSchema>;
export type SupplierPayment = typeof supplierPaymentsTable.$inferSelect;
