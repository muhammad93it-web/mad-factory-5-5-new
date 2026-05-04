import { Router } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, customerPaymentsTable, customersTable } from "@workspace/db";
import {
  ListCustomerPaymentsQueryParams,
  CreateCustomerPaymentBody,
  GetCustomerPaymentParams,
  DeleteCustomerPaymentParams,
} from "@workspace/api-zod";

const router = Router();

function mapPayment(p: typeof customerPaymentsTable.$inferSelect & { customerName?: string }) {
  return {
    ...p,
    customerName: p.customerName ?? "",
    amount: Number(p.amount),
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/customer-payments", async (req, res): Promise<void> => {
  const qp = ListCustomerPaymentsQueryParams.safeParse(req.query);
  const conditions: ReturnType<typeof eq>[] = [];
  if (qp.success) {
    if (qp.data.customerId) conditions.push(eq(customerPaymentsTable.customerId, qp.data.customerId));
    if (qp.data.fromDate) conditions.push(sql`payment_date >= ${qp.data.fromDate}` as ReturnType<typeof eq>);
    if (qp.data.toDate) conditions.push(sql`payment_date <= ${qp.data.toDate}` as ReturnType<typeof eq>);
  }

  const payments = await db
    .select({ p: customerPaymentsTable, customerName: customersTable.name })
    .from(customerPaymentsTable)
    .leftJoin(customersTable, eq(customerPaymentsTable.customerId, customersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(customerPaymentsTable.paymentDate));

  res.json(payments.map(({ p, customerName }) => mapPayment({ ...p, customerName: customerName ?? "" })));
});

router.post("/customer-payments", async (req, res): Promise<void> => {
  const parsed = CreateCustomerPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [p] = await db.insert(customerPaymentsTable).values({ ...parsed.data, amount: String(parsed.data.amount) }).returning();
  const [customer] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, parsed.data.customerId));
  res.status(201).json(mapPayment({ ...p, customerName: customer?.name ?? "" }));
});

router.get("/customer-payments/:id", async (req, res): Promise<void> => {
  const params = GetCustomerPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({ p: customerPaymentsTable, customerName: customersTable.name })
    .from(customerPaymentsTable)
    .leftJoin(customersTable, eq(customerPaymentsTable.customerId, customersTable.id))
    .where(eq(customerPaymentsTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  res.json(mapPayment({ ...row.p, customerName: row.customerName ?? "" }));
});

router.delete("/customer-payments/:id", async (req, res): Promise<void> => {
  const params = DeleteCustomerPaymentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(customerPaymentsTable).where(eq(customerPaymentsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
