import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useListSalesInvoices,
  getListSalesInvoicesQueryKey,
  useListCustomers,
  getListCustomersQueryKey,
  getSalesInvoice,
  getGetSalesInvoiceQueryKey,
  useUpdateSalesInvoice,
  useListMaterials,
} from "@workspace/api-client-react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatDate } from "@/lib/format";
import { ArrowRight, Printer, FileText, Search, Pencil, Save, X } from "lucide-react";
import { PrintStyles } from "@/components/print-styles";

type DraftItem = {
  id?: number;
  materialId: number | null;
  materialName: string;
  palletCount: number | null;
  bricksPerPallet: number | null;
  totalBricks: number | null;
  unitPrice: number;
  notes: string | null;
};

type DraftInvoice = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  // Pass-through fields preserved on save
  customerMobile: string | null;
  customerAddress: string | null;
  driver: string | null;
  driverMobile: string | null;
  vehicle: string | null;
  guarantorName: string | null;
  notes: string | null;
  discount: number;
  paidAmount: number;
  previousDebt: number;
  items: DraftItem[];
  dirty: boolean;
};

type FlatItem = {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  itemIdx: number;
  materialName: string;
  palletCount: number | null;
  bricksPerPallet: number | null;
  totalBricks: number;
  unitPrice: number;
  total: number;
};

export default function SalesConsolidated() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [generated, setGenerated] = useState(false);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, DraftInvoice>>({});

  const { data: customers } = useListCustomers({}, { query: { queryKey: getListCustomersQueryKey({}) } });
  const { data: materials } = useListMaterials({ type: "sell" }, { query: { queryKey: ["materials", "sell"] } });

  // List invoices for the selected customer + date range
  const listParams = {
    customerId: customerId ? Number(customerId) : undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  };
  const { data: invoices, isLoading } = useListSalesInvoices(listParams, {
    query: {
      queryKey: getListSalesInvoicesQueryKey(listParams),
      enabled: generated && !!customerId,
    },
  });

  // For each invoice, fetch full detail (to get items)
  const detailQueries = useQueries({
    queries: (invoices ?? []).map((inv) => ({
      queryKey: getGetSalesInvoiceQueryKey(inv.id),
      queryFn: () => getSalesInvoice(inv.id),
      enabled: generated && !!customerId,
    })),
  });

  const allLoaded = detailQueries.length > 0 && detailQueries.every((q) => q.data && !q.isLoading);

  // Build a stable signature of the loaded server data so the reset effect
  // re-runs whenever underlying invoice content changes (not just count).
  const detailSignature = useMemo(() => {
    if (!allLoaded) return "";
    return detailQueries
      .map((q) => {
        const inv = q.data as { id?: number } | undefined;
        return `${inv?.id ?? "?"}:${q.dataUpdatedAt ?? 0}`;
      })
      .sort()
      .join("|");
  }, [allLoaded, detailQueries]);

  const buildDraftsFromServer = (): Record<number, DraftInvoice> => {
    const next: Record<number, DraftInvoice> = {};
    detailQueries.forEach((q) => {
      const inv = q.data as
        | (Omit<DraftInvoice, "items" | "dirty"> & {
            items: Array<{
              id?: number;
              materialId: number | null;
              materialName: string;
              palletCount: number | null;
              bricksPerPallet: number | null;
              totalBricks: number | null;
              quantity: number;
              unitPrice: number;
              notes?: string | null;
            }>;
          })
        | undefined;
      if (!inv) return;
      next[inv.id] = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        customerMobile: inv.customerMobile ?? null,
        customerAddress: inv.customerAddress ?? null,
        driver: inv.driver ?? null,
        driverMobile: inv.driverMobile ?? null,
        vehicle: inv.vehicle ?? null,
        guarantorName: inv.guarantorName ?? null,
        notes: inv.notes ?? null,
        discount: Number(inv.discount ?? 0),
        paidAmount: Number(inv.paidAmount ?? 0),
        previousDebt: Number(inv.previousDebt ?? 0),
        items: (inv.items ?? []).map((it) => ({
          id: it.id,
          materialId: it.materialId ?? null,
          materialName: it.materialName,
          palletCount: it.palletCount ?? null,
          bricksPerPallet: it.bricksPerPallet ?? null,
          totalBricks: it.totalBricks ?? it.quantity ?? null,
          unitPrice: Number(it.unitPrice),
          notes: it.notes ?? null,
        })),
        dirty: false,
      };
    });
    return next;
  };

  // Reset drafts whenever the underlying server data changes.
  useEffect(() => {
    if (!detailSignature) return;
    setDrafts(buildDraftsFromServer());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailSignature]);

  // Flat list — uses drafts as the source of truth (so edits show immediately).
  const flat: FlatItem[] = useMemo(() => {
    const out: FlatItem[] = [];
    Object.values(drafts).forEach((inv) => {
      inv.items.forEach((it, idx) => {
        const totalBricks = it.totalBricks ?? 0;
        out.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          itemIdx: idx,
          materialName: it.materialName,
          palletCount: it.palletCount,
          bricksPerPallet: it.bricksPerPallet,
          totalBricks,
          unitPrice: it.unitPrice,
          total: totalBricks * it.unitPrice,
        });
      });
    });
    return out;
  }, [drafts]);

  const grandSubtotal = flat.reduce((s, x) => s + x.total, 0);
  const totalBricks = flat.reduce((s, x) => s + (x.totalBricks ?? 0), 0);
  const totalDiscount = Object.values(drafts).reduce((s, d) => s + (d.discount ?? 0), 0);
  const totalPaid = Object.values(drafts).reduce((s, d) => s + (d.paidAmount ?? 0), 0);
  const totalPrevDebt = Object.values(drafts).reduce((s, d) => s + (d.previousDebt ?? 0), 0);
  const grandTotal = grandSubtotal - totalDiscount;
  const totalDebt = grandTotal + totalPrevDebt - totalPaid;

  const customer = customers?.find((c) => String(c.id) === customerId);

  // ── Edit helpers ──────────────────────────────────────────────────────
  const updateItem = (invoiceId: number, itemIdx: number, field: keyof DraftItem, value: string | number | null) => {
    setDrafts((prev) => {
      const inv = prev[invoiceId];
      if (!inv) return prev;
      const items = inv.items.map((it, i) => {
        if (i !== itemIdx) return it;
        let next: DraftItem;
        if (field === "materialId") {
          if (value === null || value === "") {
            next = { ...it, materialId: null };
          } else {
            const mat = materials?.find((m: { id: number }) => m.id === Number(value));
            const newBpp = mat ? (mat.bricksPerPallet ?? null) : it.bricksPerPallet;
            next = {
              ...it,
              materialId: mat?.id ?? null,
              materialName: mat?.name ?? it.materialName,
              unitPrice: mat ? Number(mat.salePrice ?? mat.purchasePrice) : it.unitPrice,
              bricksPerPallet: newBpp,
            };
            if (next.palletCount != null && next.bricksPerPallet != null) {
              next.totalBricks = next.palletCount * next.bricksPerPallet;
            }
          }
        } else {
          next = { ...it, [field]: value as never };
        }
        if (field === "palletCount" || field === "bricksPerPallet") {
          const pc = field === "palletCount" ? (value as number | null) : it.palletCount;
          const bp = field === "bricksPerPallet" ? (value as number | null) : it.bricksPerPallet;
          if (pc != null && bp != null) next.totalBricks = pc * bp;
        }
        return next;
      });
      return { ...prev, [invoiceId]: { ...inv, items, dirty: true } };
    });
  };

  const { mutateAsync: update } = useUpdateSalesInvoice();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const handleSave = async () => {
    const dirtyList = Object.values(drafts).filter((d) => d.dirty);
    if (dirtyList.length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const failures: Array<{ invoiceNumber: string; error: string }> = [];
    try {
      for (const d of dirtyList) {
        const validItems = d.items.filter((it) => it.materialName && (it.totalBricks ?? 0) > 0);
        try {
          await update({
            id: d.id,
            data: {
              customerMobile: d.customerMobile,
              customerAddress: d.customerAddress,
              driver: d.driver,
              driverMobile: d.driverMobile,
              vehicle: d.vehicle,
              guarantorName: d.guarantorName,
              notes: d.notes,
              discount: d.discount,
              paidAmount: d.paidAmount,
              previousDebt: d.previousDebt,
              items: validItems.map((it) => ({
                materialId: it.materialId ?? undefined,
                materialName: it.materialName,
                quantity: it.totalBricks ?? 0,
                unitPrice: it.unitPrice,
                palletCount: it.palletCount ?? undefined,
                bricksPerPallet: it.bricksPerPallet ?? undefined,
                totalBricks: it.totalBricks ?? undefined,
                notes: it.notes ?? undefined,
              })),
            },
          });
          // Mark this invoice clean immediately so retries don't re-submit it.
          setDrafts((prev) => {
            const cur = prev[d.id];
            if (!cur) return prev;
            return { ...prev, [d.id]: { ...cur, dirty: false } };
          });
          queryClient.invalidateQueries({ queryKey: getGetSalesInvoiceQueryKey(d.id) });
        } catch (err) {
          failures.push({
            invoiceNumber: d.invoiceNumber,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: getListSalesInvoicesQueryKey({}) });
      if (failures.length === 0) {
        setEditing(false);
      } else {
        setSaveError(
          `${failures.length} پسووڵە تۆمارنەکرا: ${failures.map((f) => f.invoiceNumber).join(", ")}`,
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setDrafts(buildDraftsFromServer());
    setSaveError(null);
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <PrintStyles />

      {/* Action Bar */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          پسووڵەی یەکگرتووی فرۆشتن
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/sales")} className="gap-2">
            <ArrowRight className="h-4 w-4" /> گەڕانەوە
          </Button>
          {generated && allLoaded && flat.length > 0 && !editing && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
                <Pencil className="h-4 w-4" /> دەستکاری
              </Button>
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
                <Printer className="h-4 w-4" /> چاپکردن
              </Button>
            </>
          )}
          {editing && (
            <>
              <Button variant="outline" onClick={handleCancelEdit} className="gap-2" disabled={saving}>
                <X className="h-4 w-4" /> هەڵوەشاندنەوە
              </Button>
              <Button onClick={handleSave} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "تۆمارکردن..." : "پاشەکەوتکردن"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter form */}
      <Card className="print:hidden">
        <CardHeader className="pb-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">فلتەرکردن</div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">کڕیار *</Label>
              <Select value={customerId} onValueChange={setCustomerId} disabled={editing}>
                <SelectTrigger>
                  <SelectValue placeholder="هەڵبژاردنی کڕیار" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">لە بەرواری</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={editing} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">بۆ بەرواری</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={editing} />
            </div>
            <Button
              onClick={() => setGenerated(true)}
              disabled={!customerId || editing}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              <Search className="h-4 w-4" /> ئامادەکردن
            </Button>
          </div>
        </CardContent>
      </Card>

      {generated && !customerId && (
        <div className="text-center text-slate-500 p-6">تکایە کڕیارێک هەڵبژێرە</div>
      )}

      {generated && customerId && isLoading && (
        <div className="text-center text-slate-500 p-6">بەڕێکردنی پسووڵەکان...</div>
      )}

      {generated && customerId && !isLoading && (invoices?.length ?? 0) === 0 && (
        <div className="text-center text-slate-500 p-6 border border-dashed rounded-lg">
          هیچ پسووڵەیەک نەدۆزرایەوە لەم ماوەیەدا
        </div>
      )}

      {generated && customerId && (invoices?.length ?? 0) > 0 && !allLoaded && (
        <div className="text-center text-slate-500 p-6">بەڕێکردنی بڕگەکان...</div>
      )}

      {saveError && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2 print:hidden">
          {saveError}
        </div>
      )}

      {/* Consolidated A4 Invoice */}
      {generated && allLoaded && flat.length > 0 && (
        <div className="print-area bg-white border-2 border-slate-300 rounded-lg overflow-hidden text-slate-900" dir="rtl">
          {/* Red header */}
          <div className="bg-white border-b-4 border-red-700">
            <div className="flex items-stretch">
              <div className="w-44 bg-white border-l-2 border-red-700 p-2 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-red-700 rounded-md flex items-center justify-center text-white font-bold text-xs text-center leading-tight">
                  MAD<br />BRICK
                </div>
                <div className="text-[10px] text-red-700 font-bold mt-1">معمل طابوق ماد</div>
                <div className="text-[9px] text-slate-500 mt-0.5" dir="ltr">0771 153 3480</div>
                <div className="text-[9px] text-slate-500" dir="ltr">0785 153 3480</div>
              </div>
              <div className="flex-1 bg-red-700 text-white py-3 px-4 flex flex-col items-center justify-center">
                <div className="text-2xl font-extrabold">معمل طابوق ماد / کارگەی خشتی ماد</div>
                <div className="text-sm mt-1 opacity-90">پسووڵەی یەکگرتووی فرۆشتن — کۆکراوەی چەند پسووڵەیەک</div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-white px-4 py-1.5 text-xs border-t border-red-700">
              <div className="font-medium" dir="ltr">07851533480 - 07701533480 - 07511533480 :مۆبایل</div>
              <div className="font-medium">عنوان: ڕێگای جەمجەماڵ - سلێمانی</div>
            </div>
          </div>

          {/* Customer/range meta */}
          <div className="border-b border-slate-300">
            <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "12%" }} />
                <col style={{ width: "21%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "21%" }} />
              </colgroup>
              <tbody>
                <tr>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">ناوی کڕیار</th>
                  <td className="border border-slate-300 px-2 py-1.5 font-bold notes-cell" colSpan={3}>{customer?.name ?? "—"}</td>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">کۆد/کڕیار</th>
                  <td className="border border-slate-300 px-2 py-1.5 font-mono text-center" dir="ltr">{(customer?.id ?? 0).toString().padStart(3, "0")}</td>
                </tr>
                <tr>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">مۆبایل</th>
                  <td className="border border-slate-300 px-2 py-1.5" dir="ltr">{customer?.phone || "—"}</td>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">لە بەرواری</th>
                  <td className="border border-slate-300 px-2 py-1.5" dir="ltr">{fromDate ? formatDate(fromDate) : "—"}</td>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">بۆ بەرواری</th>
                  <td className="border border-slate-300 px-2 py-1.5" dir="ltr">{toDate ? formatDate(toDate) : "—"}</td>
                </tr>
                <tr>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">ژمارەی پسووڵە</th>
                  <td className="border border-slate-300 px-2 py-1.5 font-bold" dir="ltr">{invoices?.length ?? 0}</td>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">کۆی بڕگە</th>
                  <td className="border border-slate-300 px-2 py-1.5 font-bold" dir="ltr">{flat.length}</td>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">کۆی خشت</th>
                  <td className="border border-slate-300 px-2 py-1.5 font-bold tabular-nums" dir="ltr">{totalBricks.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* All items grouped by invoice */}
          <div className="p-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-emerald-100 text-slate-800 text-xs">
                  <th className="border border-slate-300 px-2 py-2 w-10">ژ</th>
                  <th className="border border-slate-300 px-2 py-2 w-24">ژ.وەسڵ</th>
                  <th className="border border-slate-300 px-2 py-2 w-24">بەروار</th>
                  <th className="border border-slate-300 px-2 py-2">ناوی ماددە</th>
                  <th className="border border-slate-300 px-2 py-2 w-20">پالیت</th>
                  <th className="border border-slate-300 px-2 py-2 w-20">لە پالیت</th>
                  <th className="border border-slate-300 px-2 py-2 w-24">کۆی خشت</th>
                  <th className="border border-slate-300 px-2 py-2 w-24">نرخ (د.ع)</th>
                  <th className="border border-slate-300 px-2 py-2 w-28">کۆی گشتی (د.ع)</th>
                </tr>
              </thead>
              <tbody>
                {flat.map((it, i) => (
                  <tr key={`${it.invoiceId}-${it.itemIdx}`}>
                    <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-500">{i + 1}</td>
                    <td className="border border-slate-300 px-2 py-1.5 font-mono text-xs" dir="ltr">{it.invoiceNumber}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center" dir="ltr">{formatDate(it.invoiceDate)}</td>

                    {/* Material name */}
                    <td className="border border-slate-300 px-1 py-1 font-medium">
                      {editing ? (
                        <Input
                          value={it.materialName}
                          onChange={(e) => updateItem(it.invoiceId, it.itemIdx, "materialName", e.target.value)}
                          className="h-7 text-sm"
                        />
                      ) : (
                        it.materialName
                      )}
                    </td>

                    {/* Pallet count */}
                    <td className="border border-slate-300 px-1 py-1 text-center tabular-nums">
                      {editing ? (
                        <Input
                          type="number"
                          value={it.palletCount ?? ""}
                          onChange={(e) => updateItem(it.invoiceId, it.itemIdx, "palletCount", e.target.value === "" ? null : Number(e.target.value))}
                          className="h-7 text-sm text-center"
                          dir="ltr"
                        />
                      ) : (
                        it.palletCount?.toLocaleString() ?? "—"
                      )}
                    </td>

                    {/* Bricks per pallet */}
                    <td className="border border-slate-300 px-1 py-1 text-center tabular-nums">
                      {editing ? (
                        <Input
                          type="number"
                          value={it.bricksPerPallet ?? ""}
                          onChange={(e) => updateItem(it.invoiceId, it.itemIdx, "bricksPerPallet", e.target.value === "" ? null : Number(e.target.value))}
                          className="h-7 text-sm text-center"
                          dir="ltr"
                        />
                      ) : (
                        it.bricksPerPallet?.toLocaleString() ?? "—"
                      )}
                    </td>

                    {/* Total bricks */}
                    <td className="border border-slate-300 px-1 py-1 text-center tabular-nums font-semibold">
                      {editing ? (
                        <Input
                          type="number"
                          value={it.totalBricks ?? ""}
                          onChange={(e) => updateItem(it.invoiceId, it.itemIdx, "totalBricks", e.target.value === "" ? null : Number(e.target.value))}
                          className="h-7 text-sm text-center"
                          dir="ltr"
                        />
                      ) : (
                        it.totalBricks.toLocaleString()
                      )}
                    </td>

                    {/* Unit price */}
                    <td className="border border-slate-300 px-1 py-1 text-center tabular-nums" dir="ltr">
                      {editing ? (
                        <Input
                          type="number"
                          value={it.unitPrice || ""}
                          onChange={(e) => updateItem(it.invoiceId, it.itemIdx, "unitPrice", Number(e.target.value))}
                          className="h-7 text-sm text-center"
                          dir="ltr"
                        />
                      ) : (
                        it.unitPrice.toLocaleString()
                      )}
                    </td>

                    {/* Line total — always derived */}
                    <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums font-bold" dir="ltr">{it.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={6} className="border border-slate-300 px-2 py-2 text-right">کۆی گشتی</td>
                  <td className="border border-slate-300 px-2 py-2 text-center tabular-nums" dir="ltr">{totalBricks.toLocaleString()}</td>
                  <td className="border border-slate-300 px-2 py-2"></td>
                  <td className="border border-slate-300 px-2 py-2 text-center tabular-nums" dir="ltr">{grandTotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Totals */}
          <div className="px-2 pb-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 text-xs text-slate-600 pt-2">
                <div className="font-bold text-slate-700">تێبینی:</div>
                <div className="notes-block border border-dashed border-slate-300 rounded p-2 min-h-[80px] bg-slate-50">
                  ئەم پسووڵە یەکگرتووە بریتییە لە کۆی {invoices?.length ?? 0} پسووڵە لەنێوان بەرواری {fromDate ? formatDate(fromDate) : "..."} و {toDate ? formatDate(toDate) : "..."}.
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-0">
                  <div className="bg-blue-100 border border-slate-300 px-3 py-2 text-sm font-bold text-right">کۆی فرۆشتن</div>
                  <div className="border border-slate-300 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(grandTotal)}</div>
                </div>
                <div className="grid grid-cols-2 gap-0">
                  <div className="bg-emerald-100 border border-slate-300 px-3 py-2 text-sm font-bold text-right">کۆی پارەدان</div>
                  <div className="border border-slate-300 px-3 py-2 text-left tabular-nums font-bold text-emerald-700" dir="ltr">{formatMoney(totalPaid)}</div>
                </div>
                <div className="grid grid-cols-2 gap-0">
                  <div className="bg-red-100 border border-slate-300 px-3 py-2 text-sm font-bold text-right">باقی قەرز</div>
                  <div className={`border border-slate-300 px-3 py-2 text-left tabular-nums font-bold ${totalDebt > 0 ? "text-red-700" : "text-emerald-700"}`} dir="ltr">{formatMoney(totalDebt)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8 mt-8 pt-4 text-xs text-slate-600">
              <div className="text-center"><div className="border-t border-slate-400 pt-1.5">واژۆی فرۆشیار</div></div>
              <div className="text-center"><div className="border-t border-slate-400 pt-1.5">واژۆی بەڕێوەبەر</div></div>
              <div className="text-center"><div className="border-t border-slate-400 pt-1.5">واژۆی کڕیار</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
