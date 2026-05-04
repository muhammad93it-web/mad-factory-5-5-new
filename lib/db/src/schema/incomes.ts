import { pgTable, text, serial, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const incomesTable = pgTable("incomes", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  incomeDate: text("income_date").notNull(),
  notes: text("notes"),
  syncStatus: text("sync_status").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("incomes_date_idx").on(t.incomeDate),
  index("incomes_category_idx").on(t.category),
]);

export const insertIncomeSchema = createInsertSchema(incomesTable).omit({ id: true, createdAt: true, syncStatus: true });
export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type Income = typeof incomesTable.$inferSelect;
