import { pgTable, text, serial, timestamp, numeric, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";

export const payrollEntriesTable = pgTable("payroll_entries", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "restrict" }),
  period: text("period").notNull(),
  workDays: numeric("work_days", { precision: 5, scale: 1 }),
  baseSalary: numeric("base_salary", { precision: 15, scale: 2 }).notNull(),
  bonus: numeric("bonus", { precision: 15, scale: 2 }).notNull().default("0"),
  deductions: numeric("deductions", { precision: 15, scale: 2 }).notNull().default("0"),
  totalDue: numeric("total_due", { precision: 15, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  remainingAmount: numeric("remaining_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  paymentDate: text("payment_date"),
  notes: text("notes"),
  syncStatus: text("sync_status").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("payroll_entries_employee_period_idx").on(t.employeeId, t.period),
  index("payroll_entries_period_idx").on(t.period),
]);

export const insertPayrollEntrySchema = createInsertSchema(payrollEntriesTable).omit({ id: true, createdAt: true, updatedAt: true, syncStatus: true });
export type InsertPayrollEntry = z.infer<typeof insertPayrollEntrySchema>;
export type PayrollEntry = typeof payrollEntriesTable.$inferSelect;
