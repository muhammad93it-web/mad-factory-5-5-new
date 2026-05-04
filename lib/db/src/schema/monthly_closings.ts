import { pgTable, text, serial, timestamp, numeric, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { shareholdersTable } from "./shareholders";

export const monthlyClosingsTable = pgTable("monthly_closings", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: text("month").notNull(),
  status: text("status").notNull().default("closed"),
  totalSales: numeric("total_sales", { precision: 15, scale: 2 }).notNull().default("0"),
  totalPurchases: numeric("total_purchases", { precision: 15, scale: 2 }).notNull().default("0"),
  totalExpenses: numeric("total_expenses", { precision: 15, scale: 2 }).notNull().default("0"),
  totalPayroll: numeric("total_payroll", { precision: 15, scale: 2 }).notNull().default("0"),
  totalOtherIncome: numeric("total_other_income", { precision: 15, scale: 2 }).notNull().default("0"),
  totalShareholderWithdrawals: numeric("total_shareholder_withdrawals", { precision: 15, scale: 2 }).notNull().default("0"),
  grossProfit: numeric("gross_profit", { precision: 15, scale: 2 }).notNull().default("0"),
  netProfit: numeric("net_profit", { precision: 15, scale: 2 }).notNull().default("0"),
  cashIn: numeric("cash_in", { precision: 15, scale: 2 }).notNull().default("0"),
  cashOut: numeric("cash_out", { precision: 15, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
  reopenedAt: timestamp("reopened_at", { withTimezone: true }),
  syncStatus: text("sync_status").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("monthly_closings_year_month_idx").on(t.year, t.month),
]);

export const profitDistributionsTable = pgTable("profit_distributions", {
  id: serial("id").primaryKey(),
  closingId: integer("closing_id").notNull().references(() => monthlyClosingsTable.id, { onDelete: "cascade" }),
  shareholderId: integer("shareholder_id").notNull().references(() => shareholdersTable.id, { onDelete: "restrict" }),
  shareholderName: text("shareholder_name").notNull(),
  sharePercentage: numeric("share_percentage", { precision: 7, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  paidAt: text("paid_at"),
  notes: text("notes"),
  syncStatus: text("sync_status").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("profit_distributions_closing_idx").on(t.closingId),
  index("profit_distributions_shareholder_idx").on(t.shareholderId),
  uniqueIndex("profit_distributions_closing_shareholder_uq").on(t.closingId, t.shareholderId),
]);

export const insertMonthlyClosingSchema = createInsertSchema(monthlyClosingsTable).omit({ id: true, createdAt: true, updatedAt: true, syncStatus: true, closedAt: true, reopenedAt: true });
export type InsertMonthlyClosing = z.infer<typeof insertMonthlyClosingSchema>;
export type MonthlyClosing = typeof monthlyClosingsTable.$inferSelect;
export type ProfitDistribution = typeof profitDistributionsTable.$inferSelect;
