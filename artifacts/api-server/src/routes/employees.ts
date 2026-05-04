import { Router } from "express";
import { eq, and, ilike, sql } from "drizzle-orm";
import { db, employeesTable } from "@workspace/db";
import {
  ListEmployeesQueryParams,
  CreateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
} from "@workspace/api-zod";

const router = Router();

function mapEmployee(e: typeof employeesTable.$inferSelect) {
  return { ...e, salary: Number(e.salary), createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString() };
}

router.get("/employees", async (req, res): Promise<void> => {
  const qp = ListEmployeesQueryParams.safeParse(req.query);
  const conditions: ReturnType<typeof eq>[] = [];
  if (qp.success) {
    if (qp.data.active !== undefined) conditions.push(eq(employeesTable.isActive, qp.data.active));
    if (qp.data.search) conditions.push(ilike(employeesTable.name, `%${qp.data.search}%`));
  }
  const employees = await db.select().from(employeesTable).where(conditions.length > 0 ? and(...conditions) : undefined);
  res.json(employees.map(mapEmployee));
});

router.post("/employees", async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [e] = await db.insert(employeesTable).values({ ...parsed.data, salary: String(parsed.data.salary) }).returning();
  res.status(201).json(mapEmployee(e));
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [e] = await db.select().from(employeesTable).where(eq(employeesTable.id, params.data.id));
  if (!e) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(mapEmployee(e));
});

router.patch("/employees/:id", async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.salary !== undefined) updateData.salary = String(parsed.data.salary);
  const [e] = await db.update(employeesTable).set(updateData).where(eq(employeesTable.id, params.data.id)).returning();
  if (!e) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }
  res.json(mapEmployee(e));
});

export default router;
