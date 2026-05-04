import { Router } from "express";
import { eq, and, isNull, ilike, inArray, sql } from "drizzle-orm";
import { db, materialsTable } from "@workspace/db";
import {
  ListMaterialsQueryParams,
  CreateMaterialBody,
  GetMaterialParams,
  UpdateMaterialParams,
  UpdateMaterialBody,
  DeleteMaterialParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/materials", async (req, res): Promise<void> => {
  const query = ListMaterialsQueryParams.safeParse(req.query);
  const conditions = [isNull(materialsTable.deletedAt)];
  if (query.success && query.data.search) {
    conditions.push(ilike(materialsTable.name, `%${query.data.search}%`));
  }
  if (query.success && query.data.type) {
    if (query.data.type === "buy") conditions.push(inArray(materialsTable.itemType, ["buy", "both"]));
    else if (query.data.type === "sell") conditions.push(inArray(materialsTable.itemType, ["sell", "both"]));
    else if (query.data.type === "both") conditions.push(eq(materialsTable.itemType, "both"));
  }
  const materials = await db.select().from(materialsTable).where(and(...conditions));
  res.json(materials.map((m) => ({
    ...m,
    purchasePrice: Number(m.purchasePrice),
    salePrice: m.salePrice != null ? Number(m.salePrice) : null,
    profitMargin: m.profitMargin != null ? Number(m.profitMargin) : null,
    profit: m.profit != null ? Number(m.profit) : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  })));
});

router.post("/materials", async (req, res): Promise<void> => {
  const parsed = CreateMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [m] = await db.insert(materialsTable).values({
    ...parsed.data,
    purchasePrice: parsed.data.purchasePrice != null ? String(parsed.data.purchasePrice) : "0",
    salePrice: parsed.data.salePrice != null ? String(parsed.data.salePrice) : null,
    profitMargin: parsed.data.profitMargin != null ? String(parsed.data.profitMargin) : null,
    profit: parsed.data.profit != null ? String(parsed.data.profit) : null,
  }).returning();
  res.status(201).json({ ...m, purchasePrice: Number(m.purchasePrice), salePrice: m.salePrice != null ? Number(m.salePrice) : null, profitMargin: m.profitMargin != null ? Number(m.profitMargin) : null, profit: m.profit != null ? Number(m.profit) : null, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() });
});

router.get("/materials/:id", async (req, res): Promise<void> => {
  const params = GetMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [m] = await db.select().from(materialsTable).where(and(eq(materialsTable.id, params.data.id), isNull(materialsTable.deletedAt)));
  if (!m) {
    res.status(404).json({ error: "Material not found" });
    return;
  }
  res.json({ ...m, purchasePrice: Number(m.purchasePrice), salePrice: m.salePrice != null ? Number(m.salePrice) : null, profitMargin: m.profitMargin != null ? Number(m.profitMargin) : null, profit: m.profit != null ? Number(m.profit) : null, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() });
});

router.patch("/materials/:id", async (req, res): Promise<void> => {
  const params = UpdateMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.purchasePrice !== undefined) updateData.purchasePrice = String(parsed.data.purchasePrice);
  if (parsed.data.salePrice !== undefined) updateData.salePrice = parsed.data.salePrice != null ? String(parsed.data.salePrice) : null;
  if (parsed.data.profitMargin !== undefined) updateData.profitMargin = parsed.data.profitMargin != null ? String(parsed.data.profitMargin) : null;
  if (parsed.data.profit !== undefined) updateData.profit = parsed.data.profit != null ? String(parsed.data.profit) : null;
  const [m] = await db.update(materialsTable).set(updateData).where(eq(materialsTable.id, params.data.id)).returning();
  if (!m) {
    res.status(404).json({ error: "Material not found" });
    return;
  }
  res.json({ ...m, purchasePrice: Number(m.purchasePrice), salePrice: m.salePrice != null ? Number(m.salePrice) : null, profitMargin: m.profitMargin != null ? Number(m.profitMargin) : null, profit: m.profit != null ? Number(m.profit) : null, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString() });
});

router.delete("/materials/:id", async (req, res): Promise<void> => {
  const params = DeleteMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(materialsTable).set({ deletedAt: new Date() }).where(eq(materialsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
