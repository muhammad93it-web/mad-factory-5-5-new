import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, payrollEntriesTable, employeesTable } from "@workspace/db";
import {
  ListPayrollEntriesQueryParams,
  CreatePayrollEntryBody,
  GetPayrollEntryParams,
  UpdatePayrollEntryParams,
  UpdatePayrollEntryBody,
  DeletePayrollEntryParams,
  GetPayrollReportQueryParams,
} from "@workspace/api-zod";

const router = Router();

function mapEntry(e: typeof payrollEntriesTable.$inferSelect & { employeeName?: string; employeeCode?: string }) {
  return {
    ...e,
    employeeName: e.employeeName ?? "",
    employeeCode: e.employeeCode ?? "",
    workDays: e.workDays != null ? Number(e.workDays) : null,
    baseSalary: Number(e.baseSalary),
    bonus: Number(e.bonus),
    deductions: Number(e.deductions),
    totalDue: Number(e.totalDue),
    paidAmount: Number(e.paidAmount),
    remainingAmount: Number(e.remainingAmount),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

router.get("/payroll", async (req, res): Promise<void> => {
  const qp = ListPayrollEntriesQueryParams.safeParse(req.query);
  const conditions: ReturnType<typeof eq>[] = [];
  if (qp.success) {
    if (qp.data.employeeId) conditions.push(eq(payrollEntriesTable.employeeId, qp.data.employeeId));
    if (qp.data.month && qp.data.year) conditions.push(sql`period = ${`${qp.data.year}-${qp.data.month}`}` as ReturnType<typeof eq>);
  }

  const entries = await db
    .select({ e: payrollEntriesTable, name: employeesTable.name, code: employeesTable.code })
    .from(payrollEntriesTable)
    .leftJoin(employeesTable, eq(payrollEntriesTable.employeeId, employeesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(payrollEntriesTable.period));

  res.json(entries.map(({ e, name, code }) => mapEntry({ ...e, employeeName: name ?? "", employeeCode: code ?? "" })));
});

router.post("/payroll", async (req, res): Promise<void> => {
  const parsed = CreatePayrollEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const bonus = parsed.data.bonus ?? 0;
  const deductions = parsed.data.deductions ?? 0;
  const paidAmount = parsed.data.paidAmount ?? 0;
  const totalDue = parsed.data.baseSalary + bonus - deductions;
  const remainingAmount = totalDue - paidAmount;

  const [e] = await db.insert(payrollEntriesTable).values({
    ...parsed.data,
    workDays: parsed.data.workDays != null ? String(parsed.data.workDays) : null,
    baseSalary: String(parsed.data.baseSalary),
    bonus: String(bonus),
    deductions: String(deductions),
    totalDue: String(totalDue),
    paidAmount: String(paidAmount),
    remainingAmount: String(remainingAmount),
  }).returning();

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, parsed.data.employeeId));
  res.status(201).json(mapEntry({ ...e, employeeName: emp?.name ?? "", employeeCode: emp?.code ?? "" }));
});

router.get("/payroll/report", async (req, res): Promise<void> => {
  const qp = GetPayrollReportQueryParams.safeParse(req.query);
  let period: string | undefined;
  if (qp.success && qp.data.year && qp.data.month) {
    period = `${qp.data.year}-${qp.data.month}`;
  }

  const conditions = period ? [sql`period = ${period}` as ReturnType<typeof eq>] : [];
  const entries = await db
    .select({ e: payrollEntriesTable, name: employeesTable.name, code: employeesTable.code })
    .from(payrollEntriesTable)
    .leftJoin(employeesTable, eq(payrollEntriesTable.employeeId, employeesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const mapped = entries.map(({ e, name, code }) => mapEntry({ ...e, employeeName: name ?? "", employeeCode: code ?? "" }));
  const totalDue = mapped.reduce((s, e) => s + e.totalDue, 0);
  const totalPaid = mapped.reduce((s, e) => s + e.paidAmount, 0);
  const totalRemaining = mapped.reduce((s, e) => s + e.remainingAmount, 0);

  res.json({ period: period ?? "all", totalDue, totalPaid, totalRemaining, entries: mapped });
});

router.get("/payroll/:id", async (req, res): Promise<void> => {
  const params = GetPayrollEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ e: payrollEntriesTable, name: employeesTable.name, code: employeesTable.code })
    .from(payrollEntriesTable)
    .leftJoin(employeesTable, eq(payrollEntriesTable.employeeId, employeesTable.id))
    .where(eq(payrollEntriesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Payroll entry not found" });
    return;
  }
  res.json(mapEntry({ ...row.e, employeeName: row.name ?? "", employeeCode: row.code ?? "" }));
});

router.patch("/payroll/:id", async (req, res): Promise<void> => {
  const params = UpdatePayrollEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePayrollEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db.select().from(payrollEntriesTable).where(eq(payrollEntriesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Payroll entry not found" });
    return;
  }
  const bonus = parsed.data.bonus ?? Number(existing.bonus);
  const deductions = parsed.data.deductions ?? Number(existing.deductions);
  const paidAmount = parsed.data.paidAmount ?? Number(existing.paidAmount);
  const totalDue = Number(existing.baseSalary) + bonus - deductions;
  const remainingAmount = totalDue - paidAmount;

  const [e] = await db.update(payrollEntriesTable).set({
    ...parsed.data,
    workDays: parsed.data.workDays != null ? String(parsed.data.workDays) : existing.workDays,
    bonus: String(bonus),
    deductions: String(deductions),
    paidAmount: String(paidAmount),
    totalDue: String(totalDue),
    remainingAmount: String(remainingAmount),
  }).where(eq(payrollEntriesTable.id, params.data.id)).returning();

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, e.employeeId));
  res.json(mapEntry({ ...e, employeeName: emp?.name ?? "", employeeCode: emp?.code ?? "" }));
});

router.delete("/payroll/:id", async (req, res): Promise<void> => {
  const params = DeletePayrollEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(payrollEntriesTable).where(eq(payrollEntriesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
