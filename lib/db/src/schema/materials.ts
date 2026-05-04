import { pgTable, text, serial, timestamp, numeric, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const materialsTable = pgTable("materials", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit"),
  purchasePrice: numeric("purchase_price", { precision: 15, scale: 2 }).notNull().default("0"),
  salePrice: numeric("sale_price", { precision: 15, scale: 2 }),
  profitMargin: numeric("profit_margin", { precision: 5, scale: 2 }),
  profit: numeric("profit", { precision: 15, scale: 2 }),
  category: text("category"),
  bricksPerPallet: integer("bricks_per_pallet"),
  itemType: text("item_type").notNull().default("both"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  syncStatus: text("sync_status").notNull().default("local"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMaterialSchema = createInsertSchema(materialsTable).omit({ id: true, createdAt: true, updatedAt: true, syncStatus: true, deletedAt: true });
export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materialsTable.$inferSelect;
