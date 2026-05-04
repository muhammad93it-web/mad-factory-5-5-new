import { pgTable, text, serial, timestamp, numeric, boolean, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shareholdersTable = pgTable("shareholders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sharePercentage: numeric("share_percentage", { precision: 7, scale: 4 }).notNull(),
  // Number of shares out of totalShares (factory-wide constant, default 100). Models the worksheet "ژمارەی پشک".
  shareCount: numeric("share_count", { precision: 10, scale: 2 }).notNull().default("0"),
  shareAmount: numeric("share_amount", { precision: 15, scale: 2 }),
  phone: text("phone"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  syncStatus: text("sync_status").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const shareholderTransactionsTable = pgTable("shareholder_transactions", {
  id: serial("id").primaryKey(),
  shareholderId: integer("shareholder_id").notNull().references(() => shareholdersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  transactionDate: text("transaction_date").notNull(),
  notes: text("notes"),
  syncStatus: text("sync_status").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("shareholder_transactions_shareholder_idx").on(t.shareholderId),
  index("shareholder_transactions_date_idx").on(t.transactionDate),
]);

export const insertShareholderSchema = createInsertSchema(shareholdersTable).omit({ id: true, createdAt: true, updatedAt: true, syncStatus: true });
export type InsertShareholder = z.infer<typeof insertShareholderSchema>;
export type Shareholder = typeof shareholdersTable.$inferSelect;
export type ShareholderTransaction = typeof shareholderTransactionsTable.$inferSelect;
