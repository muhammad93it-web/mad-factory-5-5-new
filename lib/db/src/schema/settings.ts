import { pgTable, text, serial, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  factoryName: text("factory_name").notNull().default("Mad Factory"),
  factoryNameKu: text("factory_name_ku").notNull().default("کارگەی خشتی ماد"),
  phone: text("phone"),
  address: text("address"),
  currentExchangeRate: numeric("current_exchange_rate", { precision: 12, scale: 2 }),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  emailRecipient: text("email_recipient"),
  emailSmtpHost: text("email_smtp_host"),
  emailSmtpPort: text("email_smtp_port"),
  emailSmtpUser: text("email_smtp_user"),
  emailSmtpPass: text("email_smtp_pass"),
  deletePin: text("delete_pin").notNull().default("0000"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable).omit({ id: true, updatedAt: true });
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;
