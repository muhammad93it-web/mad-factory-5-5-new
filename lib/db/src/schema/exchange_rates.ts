import { pgTable, text, serial, timestamp, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exchangeRatesTable = pgTable("exchange_rates", {
  id: serial("id").primaryKey(),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  rateDate: text("rate_date").notNull(),
  notes: text("notes"),
  syncStatus: text("sync_status").notNull().default("local"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("exchange_rates_date_idx").on(t.rateDate),
]);

export const insertExchangeRateSchema = createInsertSchema(exchangeRatesTable).omit({ id: true, createdAt: true, syncStatus: true });
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
export type ExchangeRate = typeof exchangeRatesTable.$inferSelect;
