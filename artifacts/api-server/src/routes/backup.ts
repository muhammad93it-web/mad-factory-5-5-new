import { Router } from "express";
import multer from "multer";
import nodemailer from "nodemailer";
import { pool, db, appSettingsTable } from "@workspace/db";
import { requireAdmin } from "../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const BACKUP_TABLES = [
  "app_settings",
  "exchange_rates",
  "customers",
  "suppliers",
  "materials",
  "employees",
  "shareholders",
  "sales_invoices",
  "sales_invoice_items",
  "purchase_invoices",
  "purchase_invoice_items",
  "customer_payments",
  "supplier_payments",
  "payroll_entries",
  "profit_distributions",
  "shareholder_transactions",
  "expenses",
  "incomes",
  "monthly_closings",
];

async function generateBackup(): Promise<{ data: Record<string, unknown[]>; exportedAt: string; version: string }> {
  const data: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    try {
      const result = await pool.query(`SELECT * FROM "${table}" ORDER BY id`);
      data[table] = result.rows;
    } catch {
      data[table] = [];
    }
  }
  return { version: "1.0", exportedAt: new Date().toISOString(), data };
}

async function getSettings() {
  const [s] = await db.select().from(appSettingsTable);
  return s;
}

router.get("/backup/export", requireAdmin, async (_req, res) => {
  try {
    const backup = await generateBackup();
    const json = JSON.stringify(backup, null, 2);
    const filename = `mad-factory-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(json);
  } catch {
    res.status(500).json({ error: "هەڵە لە دروستکردنی باکئەپ" });
  }
});

router.post("/backup/restore", requireAdmin, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "فایلی باکئەپ نەدراوە" });
      return;
    }
    const content = req.file.buffer.toString("utf-8");
    const backup = JSON.parse(content) as { version?: string; data?: Record<string, unknown[]> };
    if (!backup.data) {
      res.status(400).json({ error: "فایلی باکئەپ دروست نییە" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const reverseTables = [...BACKUP_TABLES].reverse().filter((t) => t !== "app_settings");
      for (const table of reverseTables) {
        await client.query(`DELETE FROM "${table}"`);
      }

      for (const table of BACKUP_TABLES) {
        if (table === "app_settings") continue;
        const rows = backup.data[table];
        if (!rows?.length) continue;
        const cols = Object.keys(rows[0] as object);
        for (const row of rows) {
          const vals = cols.map((c) => (row as Record<string, unknown>)[c]);
          const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
          const colList = cols.map((c) => `"${c}"`).join(", ");
          const updateSet = cols.map((c, i) => `"${c}" = $${i + 1}`).join(", ");
          await client.query(
            `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateSet}`,
            vals,
          );
        }
        await client.query(
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
        );
      }

      await client.query("COMMIT");
      res.json({ ok: true, message: "باکئەپ بە سەرکەوتوویی گەڕاندرایەوە" });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: `هەڵە لە گەڕاندنەوەی باکئەپ: ${err instanceof Error ? err.message : "نەزانراو"}` });
  }
});

router.post("/backup/send-telegram", requireAdmin, async (_req, res) => {
  try {
    const settings = await getSettings();
    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      res.status(400).json({ error: "تۆکنی بۆتی تێلێگرام و ئایدی چات پێویستن" });
      return;
    }
    const backup = await generateBackup();
    const json = JSON.stringify(backup, null, 2);
    const filename = `mad-factory-backup-${new Date().toISOString().slice(0, 10)}.json`;

    const form = new FormData();
    form.append("chat_id", settings.telegramChatId);
    form.append("caption", `📦 باکئەپی کارگەی خشتی ماد\n📅 ${new Date().toLocaleDateString("en-US")}`);
    const blob = new Blob([json], { type: "application/json" });
    form.append("document", blob, filename);

    const tgRes = await fetch(
      `https://api.telegram.org/bot${settings.telegramBotToken}/sendDocument`,
      { method: "POST", body: form },
    );

    if (!tgRes.ok) {
      const errBody = await tgRes.text();
      res.status(400).json({ error: `هەڵەی تێلێگرام: ${errBody}` });
      return;
    }
    res.json({ ok: true, message: "باکئەپ بە سەرکەوتوویی بۆ تێلێگرام نێردرا" });
  } catch (err) {
    res.status(500).json({ error: `هەڵە: ${err instanceof Error ? err.message : "نەزانراو"}` });
  }
});

router.post("/backup/send-email", requireAdmin, async (_req, res) => {
  try {
    const settings = await getSettings();
    if (!settings?.emailRecipient || !settings?.emailSmtpHost || !settings?.emailSmtpUser || !settings?.emailSmtpPass) {
      res.status(400).json({ error: "ڕێکخستنی ئیمەیڵ تەواو نییە" });
      return;
    }
    const backup = await generateBackup();
    const json = JSON.stringify(backup, null, 2);
    const filename = `mad-factory-backup-${new Date().toISOString().slice(0, 10)}.json`;

    const transporter = nodemailer.createTransport({
      host: settings.emailSmtpHost,
      port: settings.emailSmtpPort ? Number(settings.emailSmtpPort) : 587,
      secure: Number(settings.emailSmtpPort) === 465,
      auth: { user: settings.emailSmtpUser, pass: settings.emailSmtpPass },
    });

    await transporter.sendMail({
      from: settings.emailSmtpUser,
      to: settings.emailRecipient,
      subject: `باکئەپی کارگەی خشتی ماد - ${new Date().toLocaleDateString("en-US")}`,
      text: "باکئەپی داتای سیستەمی کارگەی خشتی ماد پابەست کراوە.",
      attachments: [{ filename, content: Buffer.from(json), contentType: "application/json" }],
    });

    res.json({ ok: true, message: "باکئەپ بە سەرکەوتوویی بۆ ئیمەیڵ نێردرا" });
  } catch (err) {
    res.status(500).json({ error: `هەڵە: ${err instanceof Error ? err.message : "نەزانراو"}` });
  }
});

export default router;
