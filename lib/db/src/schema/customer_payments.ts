import { pgTable, text, serial, timestamp, numeric, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";

export const customerPaymentsTable = pgTable("customer_payments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id, { onDelete: "restrict" }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  paymentDate: text("payment_date").notNull(),
  // Voucher type: "cash" (وەصڵ پارە قبض — direct cash receipt) | "internal" (وەرگرتن ناو وەصڵ — internal voucher)
  voucherType: text("voucher_type").notNull().default("cash"),
  notes: text("notes"),
  syncStatus: text("sync_status").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("customer_payments_customer_idx").on(t.customerId),
  index("customer_payments_date_idx").on(t.paymentDate),
]);

export const insertCustomerPaymentSchema = createInsertSchema(customerPaymentsTable).omit({ id: true, createdAt: true, syncStatus: true });
export type InsertCustomerPayment = z.infer<typeof insertCustomerPaymentSchema>;
export type CustomerPayment = typeof customerPaymentsTable.$inferSelect;
