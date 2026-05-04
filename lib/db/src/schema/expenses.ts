import { pgTable, text, serial, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  expenseDate: text("expense_date").notNull(),
  notes: text("notes"),
  syncStatus: text("sync_status").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("expenses_date_idx").on(t.expenseDate),
  index("expenses_category_idx").on(t.category),
]);

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true, syncStatus: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
