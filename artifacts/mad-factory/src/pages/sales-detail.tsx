import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetSalesInvoice,
  getGetSalesInvoiceQueryKey,
  useUpdateSalesInvoice,
  getListSalesInvoicesQueryKey,
  useListMaterials,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney, formatDate } from "@/lib/format";
import {
  ArrowRight,
  Printer,
  FileSpreadsheet,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  TriangleAlert,
  Wallet,
  Percent,
} from "lucide-react";
import { exportTableToExcel, buildInvoiceTableHtml } from "@/lib/export";
import { PrintStyles } from "@/components/print-styles";
import { PinConfirmModal } from "@/components/pin-confirm-modal";
import { CustomerLedgerSummary } from "@/components/customer-ledger-summary";

type DraftItem = {
  id?: number;
  materialId: number | null;
  materialName: string;
  palletCount: number | null;
  bricksPerPallet: number | null;
  totalBricks: number | null;
  unitPrice: number;
};

export default function SalesDetail() {
  const [, params] = useRoute("/sales/:id");
  const [, navigate] = useLocation();
  const id = params?.id ? Number(params.id) : 0;
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useGetSalesInvoice(id, {
    query: { enabled: !!id, queryKey: getGetSalesInvoiceQueryKey(id) },
  });
  // Sales detail edits sales-only items, so filter to sell/both
  const { data: materials } = useListMaterials({ type: "sell" }, { query: { queryKey: ["materials", "sell"] } });

  // Pretty delete confirmation for material rows
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);

  // Edit-mode state
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{
    customerMobile: string;
    customerAddress: string;
    driver: string;
    driverMobile: string;
    vehicle: string;
    guarantorName: string;
    notes: string;
    discount: number;
    paidAmount: number;
    previousDebt: number;
    items: DraftItem[];
  } | null>(null);

  const resetDraft = () => {
    if (!invoice) return;
    setDraft({
      customerMobile: invoice.customerMobile ?? "",
      customerAddress: invoice.customerAddress ?? "",
      driver: invoice.driver ?? "",
      driverMobile: invoice.driverMobile ?? "",
      vehicle: invoice.vehicle ?? "",
      guarantorName: invoice.guarantorName ?? "",
      notes: invoice.notes ?? "",
      discount: invoice.discount ?? 0,
      paidAmount: invoice.paidAmount ?? 0,
      previousDebt: invoice.previousDebt ?? 0,
      items: invoice.items.map((it) => ({
        id: it.id,
        materialId: it.materialId ?? null,
        materialName: it.materialName,
        palletCount: it.palletCount ?? null,
        bricksPerPallet: it.bricksPerPallet ?? null,
        totalBricks: it.totalBricks ?? (typeof it.quantity === "number" ? it.quantity : null),
        unitPrice: it.unitPrice,
      })),
    });
  };

  // Initialize draft once invoice is loaded
  useEffect(() => {
    if (invoice && !draft) resetDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice]);

  const { mutate: update, isPending: saving } = useUpdateSalesInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSalesInvoiceQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListSalesInvoicesQueryKey({}) });
        setEditing(false);
      },
    },
  });

  // Auto-print via ?print=1
  const autoPrintedRef = useRef(false);
  useEffect(() => {
    if (autoPrintedRef.current) return;
    if (!invoice) return;
    const wantsPrint = new URLSearchParams(window.location.search).get("print") === "1";
    if (!wantsPrint) return;
    autoPrintedRef.current = true;
    const t = setTimeout(() => {
      window.print();
      const url = new URL(window.location.href);
      url.searchParams.delete("print");
      window.history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
    }, 350);
    return () => clearTimeout(t);
  }, [invoice]);

  // Live totals (use draft when editing, invoice otherwise)
  const liveTotals = useMemo(() => {
    if (editing && draft) {
      const subtotal = draft.items.reduce((s, it) => s + (it.totalBricks ?? 0) * it.unitPrice, 0);
      const total = subtotal - draft.discount;
      const remaining = total + draft.previousDebt - draft.paidAmount;
      return { subtotal, total, remaining };
    }
    return invoice
      ? { subtotal: invoice.subtotal ?? invoice.total, total: invoice.total, remaining: invoice.remainingDebt }
      : { subtotal: 0, total: 0, remaining: 0 };
  }, [editing, draft, invoice]);

  if (isLoading) return <div className="p-8 text-center text-slate-500">بەڕێکردن...</div>;
  if (!invoice) return <div className="p-8 text-center text-destructive">پسووڵە نەدۆزرایەوە</div>;

  // ----- Helpers for editing -----
  const updateItem = (idx: number, field: keyof DraftItem, value: string | number | null) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((it, i) => {
          if (i !== idx) return it;
          let next: DraftItem;
          if (field === "materialId") {
            // Picking from saved materials → fill name/price/bricksPerPallet
            if (value === null || value === "") {
              // "ناوی نوێ" — clear material binding so user can type custom name
              next = { ...it, materialId: null, materialName: "" };
            } else {
              const mat = materials?.find((m: { id: number }) => m.id === Number(value));
              // When switching material, explicitly take the NEW material's bricksPerPallet
              // (which may be null) — never fall back to the previous material's value.
              const newBpp = mat ? (mat.bricksPerPallet ?? null) : it.bricksPerPallet;
              next = {
                ...it,
                materialId: mat?.id ?? null,
                materialName: mat?.name ?? it.materialName,
                unitPrice: mat ? Number(mat.salePrice ?? mat.purchasePrice) : it.unitPrice,
                bricksPerPallet: newBpp,
              };
              // Always recompute totalBricks based on the new bricksPerPallet — clear if either side missing
              if (next.palletCount != null && next.bricksPerPallet != null) {
                next.totalBricks = next.palletCount * next.bricksPerPallet;
              } else {
                next.totalBricks = null;
              }
            }
          } else if (field === "materialName") {
            // Free-text override → if name no longer matches the bound material, drop the binding
            const newName = (value ?? "") as string;
            const bound = materials?.find((m: { id: number }) => m.id === it.materialId);
            const stillMatches = bound && bound.name === newName;
            next = { ...it, materialName: newName, materialId: stillMatches ? it.materialId : null };
          } else {
            next = { ...it, [field]: value as never };
          }
          if (field === "palletCount" || field === "bricksPerPallet") {
            const pc = field === "palletCount" ? (value as number | null) : it.palletCount;
            const bp = field === "bricksPerPallet" ? (value as number | null) : it.bricksPerPallet;
            if (pc != null && bp != null) next.totalBricks = pc * bp;
          }
          return next;
        }),
      };
    });
  };

  const addRow = () => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            items: [
              ...prev.items,
              { materialId: null, materialName: "", palletCount: null, bricksPerPallet: null, totalBricks: null, unitPrice: 0 },
            ],
          }
        : prev,
    );
  };

  const requestRemoveRow = (idx: number) => {
    if (!draft) return;
    const it = draft.items[idx];
    // If row is completely empty, just delete without asking
    const isEmpty =
      !it?.materialName &&
      !it?.materialId &&
      !it?.totalBricks &&
      !it?.palletCount &&
      !it?.bricksPerPallet &&
      !it?.unitPrice;
    if (isEmpty) {
      setDraft({ ...draft, items: draft.items.filter((_, i) => i !== idx) });
      return;
    }
    setPendingDeleteIdx(idx);
  };

  const confirmRemoveRow = () => {
    if (pendingDeleteIdx == null) return;
    setDraft((prev) =>
      prev ? { ...prev, items: prev.items.filter((_, i) => i !== pendingDeleteIdx) } : prev,
    );
    setPendingDeleteIdx(null);
  };

  const handleSave = () => {
    if (!draft) return;
    const validItems = draft.items.filter((it) => it.materialName && (it.totalBricks ?? 0) > 0);
    update({
      id,
      data: {
        customerMobile: draft.customerMobile || null,
        customerAddress: draft.customerAddress || null,
        driver: draft.driver || null,
        driverMobile: draft.driverMobile || null,
        vehicle: draft.vehicle || null,
        guarantorName: draft.guarantorName || null,
        notes: draft.notes || null,
        discount: draft.discount,
        paidAmount: draft.paidAmount,
        previousDebt: draft.previousDebt,
        items: validItems.map((it) => ({
          materialId: it.materialId ?? undefined,
          materialName: it.materialName,
          quantity: it.totalBricks ?? 0,
          unitPrice: it.unitPrice,
          palletCount: it.palletCount ?? undefined,
          bricksPerPallet: it.bricksPerPallet ?? undefined,
          totalBricks: it.totalBricks ?? undefined,
          notes: undefined,
        })),
      },
    });
  };

  const handleExport = () => {
    const html = buildInvoiceTableHtml({
      title: `وەسڵی فرۆشتن — ${invoice.invoiceNumber}`,
      meta: [
        ["ژمارەی وەسڵ", invoice.invoiceNumber],
        ["بەروار", formatDate(invoice.invoiceDate)],
        ["کڕیار", invoice.customerName],
        ["مۆبایلی کڕیار", invoice.customerMobile || "-"],
        ["ناونیشان", invoice.customerAddress || "-"],
        ["شۆفێر", invoice.driver || "-"],
        ["مۆبایلی شۆفێر", invoice.driverMobile || "-"],
        ["جۆر و ژمارەی ئۆتۆمبێل", invoice.vehicle || "-"],
        ["کەفیل", invoice.guarantorName || "-"],
        ["تێبینی", invoice.notes || "-"],
      ],
      itemHeaders: ["ژ", "ناوی ماددە", "ژمارەی پالیت", "لە پالیت", "کۆی خشت", "یەکە", "نرخ", "کۆی گشتی"],
      itemRows: invoice.items.map((it, i) => [
        i + 1,
        it.materialName,
        it.palletCount ?? "-",
        it.bricksPerPallet ?? "-",
        it.totalBricks ?? it.quantity,
        it.totalBricks != null ? "خشت" : "-",
        it.unitPrice.toLocaleString(),
        it.total.toLocaleString(),
      ]),
      totals: [
        ["کۆی فرۆشتن", `${invoice.total.toLocaleString()} د.ع`],
        ["قەرزی پێشوو", `${(invoice.previousDebt ?? 0).toLocaleString()} د.ع`],
        ["کۆی گشتی پاش قەرزی پێشوو", `${(invoice.total + (invoice.previousDebt ?? 0)).toLocaleString()} د.ع`],
        ["کۆی پارەدان", `${invoice.paidAmount.toLocaleString()} د.ع`],
        ["باقی قەرز", `${invoice.remainingDebt.toLocaleString()} د.ع`],
      ],
    });
    exportTableToExcel(`${invoice.invoiceNumber}.xls`, html);
  };

  // Display values: prefer draft when editing, otherwise invoice
  const v = (key: keyof NonNullable<typeof draft>): string => {
    if (editing && draft) return String(draft[key] ?? "");
    return String((invoice as unknown as Record<string, unknown>)[key] ?? "") || "—";
  };

  return (
    <div className="space-y-4">
      <PrintStyles />
      {/* Action Bar */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          وەسڵی فرۆشتن
          {editing && (
            <span className="mr-2 inline-block bg-amber-100 text-amber-800 text-sm px-2 py-0.5 rounded border border-amber-300">
              دۆخی دەستکاری
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/sales")} className="gap-2">
            <ArrowRight className="h-4 w-4" /> گەڕانەوە
          </Button>
          {!editing ? (
            <>
              <Button variant="outline" onClick={() => window.print()} className="gap-2">
                <Printer className="h-4 w-4" /> چاپکردن
              </Button>
              <Button onClick={handleExport} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                <FileSpreadsheet className="h-4 w-4" /> ئێکسڵ
              </Button>
              <Button
                onClick={() => {
                  resetDraft();
                  setEditing(true);
                }}
                className="gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              >
                <Pencil className="h-4 w-4" /> دەستکاری
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  resetDraft();
                  setEditing(false);
                }}
                className="gap-2"
              >
                <X className="h-4 w-4" /> پاشگەزبوونەوە
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Save className="h-4 w-4" />
                {saving ? "پاشەکەوت دەکرێت..." : "پاشەکەوت کردن"}
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Invoice Document — matches Mad Brick template */}
      <div className="print-area bg-white border-2 border-slate-300 rounded-lg overflow-hidden text-slate-900" dir="rtl">
        {/* Red header */}
        <div className="bg-white border-b-4 border-red-700">
          <div className="flex items-stretch">
            <div className="w-44 bg-white border-l-2 border-red-700 p-2 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-red-700 rounded-md flex items-center justify-center text-white font-bold text-xs text-center leading-tight">
                MAD<br/>BRICK
              </div>
              <div className="text-[10px] text-red-700 font-bold mt-1">معمل طابوق ماد</div>
              <div className="text-[9px] text-slate-500 mt-0.5" dir="ltr">0771 153 3480</div>
              <div className="text-[9px] text-slate-500" dir="ltr">0785 153 3480</div>
            </div>
            <div className="flex-1 bg-red-700 text-white py-3 px-4 flex flex-col items-center justify-center">
              <div className="text-2xl font-extrabold">معمل طابوق ماد / کارگەی خشتی ماد</div>
              <div className="text-sm mt-1 opacity-90">بۆ دروستکردنی هەموو جۆرە خشتێک بە تاک و بەکۆ</div>
            </div>
          </div>
          <div className="flex items-center justify-between bg-white px-4 py-1.5 text-xs border-t border-red-700">
            <div className="font-medium" dir="ltr">07851533480 - 07701533480 - 07511533480 :مۆبایل</div>
            <div className="font-medium">عنوان: ڕێگای جەمجەماڵ - سلێمانی</div>
          </div>
        </div>

        {/* Customer / invoice meta — print header reorganized to match the input form:
            • Receipt number + buyer code sit narrow side-by-side on row 1
            • Notes get their own full-width row with strict word-wrapping so long text
              cannot break the table borders. */}
        <div className="border-b border-slate-300">
          <table className="w-full text-sm border-collapse" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "24%" }} />
            </colgroup>
            <tbody>
              {/* Row 1 — invoice meta (narrow ژ.وەسڵ + narrow کۆد/کڕیار + بەروار + مۆبایل) */}
              <tr>
                <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">ژ.وەسڵ</th>
                <td className="border border-slate-300 px-2 py-1.5 font-bold font-mono text-center" dir="ltr">{invoice.invoiceNumber}</td>
                <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">کۆد/کڕیار</th>
                <td className="border border-slate-300 px-2 py-1.5 font-mono text-center" dir="ltr">{invoice.customerId.toString().padStart(3, "0")}</td>
                <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">بەروار</th>
                <td className="border border-slate-300 px-2 py-1.5" dir="ltr">{formatDate(invoice.invoiceDate)}</td>
                <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">مۆبایل</th>
                <td className="border border-slate-300 px-2 py-1.5" dir="ltr">
                  {editing && draft ? (
                    <Input
                      value={draft.customerMobile}
                      onChange={(e) => setDraft({ ...draft, customerMobile: e.target.value })}
                      className="h-7 text-sm"
                      dir="ltr"
                    />
                  ) : (
                    invoice.customerMobile || "—"
                  )}
                </td>
              </tr>

              {/* Row 2 — customer + address */}
              <tr>
                <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">ناوی کڕیار</th>
                <td className="border border-slate-300 px-2 py-1.5 font-bold notes-cell" colSpan={3}>
                  <div className="flex items-center justify-between gap-2">
                    <span>{invoice.customerName}</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/customer-statement?customerId=${invoice.customerId}&general=1`)}
                      className="print:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded border border-emerald-400 text-emerald-700 hover:bg-emerald-50 text-[11px] font-bold"
                      title="کەشف حسابی ئەم کڕیارە"
                    >
                      <FileSpreadsheet className="h-3 w-3" />کەشف حساب
                    </button>
                  </div>
                </td>
                <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">ناونیشان</th>
                <td className="border border-slate-300 px-2 py-1.5 notes-cell" colSpan={3}>
                  {editing && draft ? (
                    <Input
                      value={draft.customerAddress}
                      onChange={(e) => setDraft({ ...draft, customerAddress: e.target.value })}
                      className="h-7 text-sm"
                    />
                  ) : (
                    invoice.customerAddress || "—"
                  )}
                </td>
              </tr>

              {/* Row 3 — driver + vehicle */}
              <tr>
                <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">شۆفێر</th>
                <td className="border border-slate-300 px-2 py-1.5">
                  {editing && draft ? (
                    <Input
                      value={draft.driver}
                      onChange={(e) => setDraft({ ...draft, driver: e.target.value })}
                      className="h-7 text-sm"
                    />
                  ) : (
                    invoice.driver || "—"
                  )}
                </td>
                <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">مۆبایلی شۆفێر</th>
                <td className="border border-slate-300 px-2 py-1.5" dir="ltr">
                  {editing && draft ? (
                    <Input
                      value={draft.driverMobile}
                      onChange={(e) => setDraft({ ...draft, driverMobile: e.target.value })}
                      className="h-7 text-sm"
                      dir="ltr"
                    />
                  ) : (
                    invoice.driverMobile || "—"
                  )}
                </td>
                <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">جۆر و ژمارە</th>
                <td className="border border-slate-300 px-2 py-1.5 notes-cell" dir="ltr" colSpan={3}>
                  {editing && draft ? (
                    <Input
                      value={draft.vehicle}
                      onChange={(e) => setDraft({ ...draft, vehicle: e.target.value })}
                      className="h-7 text-sm"
                      dir="ltr"
                    />
                  ) : (
                    invoice.vehicle || "—"
                  )}
                </td>
              </tr>

              {/* Row 4 — notes (full width, hard-wrapping so long unbroken text never overflows) */}
              <tr>
                <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right align-top">تێبینی</th>
                <td className="border border-slate-300 px-2 py-1.5 notes-cell align-top" colSpan={7}>
                  {editing && draft ? (
                    <Input
                      value={draft.notes}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                      className="h-7 text-sm"
                    />
                  ) : (
                    invoice.notes || "—"
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Items table */}
        <div className="p-2">
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "32%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "13%" }} />
              {editing && <col style={{ width: "5%" }} className="print:hidden" />}
            </colgroup>
            <thead>
              <tr className="bg-emerald-100 text-slate-800 text-xs">
                <th className="border border-slate-300 px-2 py-2 whitespace-nowrap">ژ</th>
                <th className="border border-slate-300 px-2 py-2 whitespace-nowrap">ناوی ماددە</th>
                <th className="border border-slate-300 px-2 py-2 whitespace-nowrap">ژمارەی پالیت</th>
                <th className="border border-slate-300 px-2 py-2 whitespace-nowrap">لە پالیت</th>
                <th className="border border-slate-300 px-2 py-2 whitespace-nowrap">کۆی خشت</th>
                <th className="border border-slate-300 px-2 py-2 whitespace-nowrap">یەکە</th>
                <th className="border border-slate-300 px-2 py-2 whitespace-nowrap">سعر (د.ع)</th>
                <th className="border border-slate-300 px-2 py-2 whitespace-nowrap">کۆی گشتی (د.ع)</th>
                {editing && <th className="border border-slate-300 px-2 py-2 print:hidden">×</th>}
              </tr>
            </thead>
            <tbody>
              {editing && draft ? (
                draft.items.length === 0 ? (
                  <tr><td colSpan={9} className="border border-slate-300 px-3 py-6 text-center text-slate-400">هیچ بڕگەیەک نییە</td></tr>
                ) : draft.items.map((it, i) => {
                  const rowTotal = (it.totalBricks ?? 0) * it.unitPrice;
                  return (
                    <tr key={i}>
                      <td className="border border-slate-300 px-1 py-1 text-center text-slate-500">{i + 1}</td>
                      <td className="border border-slate-300 px-1 py-1">
                        <div className="flex gap-1 items-center">
                          <select
                            value={it.materialId ?? ""}
                            onChange={(e) =>
                              updateItem(i, "materialId", e.target.value === "" ? null : e.target.value)
                            }
                            className="h-7 rounded border border-slate-300 bg-white px-1 text-xs w-20 shrink-0"
                            title="هەڵبژاردن لە خەزن کراوەکان"
                          >
                            <option value="">— نوێ —</option>
                            {materials?.map((m: { id: number; name: string }) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                          <Input
                            value={it.materialName}
                            onChange={(e) => updateItem(i, "materialName", e.target.value)}
                            placeholder="یان ناو بنووسە..."
                            className="h-7 text-sm flex-1 min-w-0"
                          />
                        </div>
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <Input
                          type="number"
                          value={it.palletCount ?? ""}
                          onChange={(e) => updateItem(i, "palletCount", e.target.value === "" ? null : Number(e.target.value))}
                          className="h-7 text-sm text-center tabular-nums"
                          dir="ltr"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <Input
                          type="number"
                          value={it.bricksPerPallet ?? ""}
                          onChange={(e) => updateItem(i, "bricksPerPallet", e.target.value === "" ? null : Number(e.target.value))}
                          className="h-7 text-sm text-center tabular-nums"
                          dir="ltr"
                        />
                      </td>
                      <td className="border border-slate-300 px-1 py-1">
                        <Input
                          type="number"
                          value={it.totalBricks ?? ""}
                          onChange={(e) => updateItem(i, "totalBricks", e.target.value === "" ? null : Number(e.target.value))}
                          className="h-7 text-sm text-center tabular-nums font-semibold"
                          dir="ltr"
                        />
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center text-xs text-slate-500">خشت</td>
                      <td className="border border-slate-300 px-1 py-1">
                        <Input
                          type="number"
                          value={it.unitPrice || ""}
                          onChange={(e) => updateItem(i, "unitPrice", e.target.value === "" ? 0 : Number(e.target.value))}
                          className="h-7 text-sm text-center tabular-nums"
                          dir="ltr"
                        />
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums font-bold" dir="ltr">
                        {rowTotal.toLocaleString()}
                      </td>
                      <td className="border border-slate-300 px-1 py-1 text-center print:hidden">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => requestRemoveRow(i)}
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <>
                  {invoice.items.length === 0 ? (
                    <tr><td colSpan={8} className="border border-slate-300 px-3 py-6 text-center text-slate-400">هیچ بڕگەیەک نییە</td></tr>
                  ) : invoice.items.map((it, i) => (
                    <tr key={it.id}>
                      <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-500">{i + 1}</td>
                      <td className="border border-slate-300 px-2 py-1.5 font-medium break-words">{it.materialName}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">{it.palletCount?.toLocaleString() ?? "—"}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">{it.bricksPerPallet?.toLocaleString() ?? "—"}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums font-semibold">{(it.totalBricks ?? it.quantity).toLocaleString()}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center text-xs text-slate-500">{it.totalBricks != null ? "خشت" : "—"}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums" dir="ltr">{it.unitPrice.toLocaleString()}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums font-bold" dir="ltr">{it.total.toLocaleString()}</td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 6 - invoice.items.length) }).map((_, i) => (
                    <tr key={`empty-${i}`}>
                      <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-300">{invoice.items.length + i + 1}</td>
                      <td className="border border-slate-300 px-2 py-1.5">&nbsp;</td>
                      <td className="border border-slate-300 px-2 py-1.5">&nbsp;</td>
                      <td className="border border-slate-300 px-2 py-1.5">&nbsp;</td>
                      <td className="border border-slate-300 px-2 py-1.5">&nbsp;</td>
                      <td className="border border-slate-300 px-2 py-1.5">&nbsp;</td>
                      <td className="border border-slate-300 px-2 py-1.5">&nbsp;</td>
                      <td className="border border-slate-300 px-2 py-1.5">&nbsp;</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>

          {editing && (
            <div className="mt-2 print:hidden">
              <Button
                type="button"
                size="sm"
                onClick={addRow}
                className="bg-blue-500 hover:bg-blue-600 text-white gap-1"
              >
                <Plus className="h-4 w-4" /> زیادکردنی ڕیز
              </Button>
            </div>
          )}
        </div>

        {/* Totals & notes */}
        <div className="px-2 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 text-xs text-slate-600 pt-2">
              <div className="font-bold text-slate-700">تێبینی:</div>
              <div className="notes-block border border-dashed border-slate-300 rounded p-2 min-h-[80px] bg-slate-50">
                {editing && draft ? draft.notes : invoice.notes || ""}
              </div>
              <div className="text-[10px] text-slate-500 mt-2">
                هەڵە و لە یادچوون دەگەڕێنرێتەوە بۆ هەردوولا — تێبینی ماددەی فرۆشراو وەرناگیرێت
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-0">
                <div className="bg-blue-100 border border-slate-300 px-3 py-2 text-sm font-bold text-right">کۆی فرۆشتن</div>
                <div className="border border-slate-300 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(liveTotals.total)}</div>
              </div>

              {editing && draft ? (
                <>
                  <div className="grid grid-cols-2 gap-0">
                    <div className="bg-amber-100 border border-slate-300 px-3 py-2 text-sm font-bold text-right">قەرزی پێشوو</div>
                    <Input
                      type="number"
                      value={draft.previousDebt || ""}
                      onChange={(e) => setDraft({ ...draft, previousDebt: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="border border-slate-300 px-3 py-2 text-left tabular-nums font-bold rounded-none h-auto"
                      dir="ltr"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-0">
                    <div className="bg-rose-100 border border-slate-300 px-3 py-2 text-sm font-bold text-right">حەسم</div>
                    <Input
                      type="number"
                      value={draft.discount || ""}
                      onChange={(e) => setDraft({ ...draft, discount: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="border border-slate-300 px-3 py-2 text-left tabular-nums font-bold rounded-none h-auto"
                      dir="ltr"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-0">
                    <div className="bg-emerald-100 border border-slate-300 px-3 py-2 text-sm font-bold text-right">کۆی پارەدان</div>
                    <Input
                      type="number"
                      value={draft.paidAmount || ""}
                      onChange={(e) => setDraft({ ...draft, paidAmount: e.target.value === "" ? 0 : Number(e.target.value) })}
                      className="border border-slate-300 px-3 py-2 text-left tabular-nums font-bold text-emerald-700 rounded-none h-auto"
                      dir="ltr"
                    />
                  </div>
                  {/* Quick-fill payment buttons */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!draft) return;
                        const subtotal = draft.items.reduce((s, it) => s + (it.totalBricks ?? 0) * it.unitPrice, 0);
                        const fullDue = subtotal + (draft.previousDebt ?? 0);
                        setDraft({ ...draft, paidAmount: Math.max(0, Math.round(fullDue)) });
                      }}
                      className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition"
                      title="کۆی گشتی فرۆشتن + قەرزی پێشوو، بێ داشکاندن"
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      = کۆی گشتی
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!draft) return;
                        const subtotal = draft.items.reduce((s, it) => s + (it.totalBricks ?? 0) * it.unitPrice, 0);
                        const grandTotal = subtotal - (draft.discount ?? 0) + (draft.previousDebt ?? 0);
                        setDraft({ ...draft, paidAmount: Math.max(0, Math.round(grandTotal)) });
                      }}
                      className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition"
                      title="کۆی گشتی پاش لابردنی داشکاندن"
                    >
                      <Percent className="h-3.5 w-3.5" />
                      = دوای داشکاندن
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {(invoice.previousDebt ?? 0) > 0 && (
                    <div className="grid grid-cols-2 gap-0">
                      <div className="bg-amber-100 border border-slate-300 px-3 py-2 text-sm font-bold text-right">قەرزی پێشوو</div>
                      <div className="border border-slate-300 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(invoice.previousDebt ?? 0)}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-0">
                    <div className="bg-emerald-100 border border-slate-300 px-3 py-2 text-sm font-bold text-right">کۆی پارەدان</div>
                    <div className="border border-slate-300 px-3 py-2 text-left tabular-nums font-bold text-emerald-700" dir="ltr">{formatMoney(invoice.paidAmount)}</div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-0">
                <div className="bg-red-100 border border-slate-300 px-3 py-2 text-sm font-bold text-right">باقی قەرز</div>
                <div className={`border border-slate-300 px-3 py-2 text-left tabular-nums font-bold ${liveTotals.remaining > 0 ? "text-red-700" : "text-emerald-700"}`} dir="ltr">{formatMoney(liveTotals.remaining)}</div>
              </div>
            </div>
          </div>

          {/* Dynamic Customer Ledger Summary — also visible in print */}
          <div className="mt-3">
            <CustomerLedgerSummary
              customerId={invoice.customerId ?? null}
              currentInvoiceTotal={liveTotals.total}
              currentPayment={editing && draft ? draft.paidAmount : invoice.paidAmount}
              excludeInvoiceTotal={invoice.total}
              excludeInvoicePaid={invoice.paidAmount}
            />
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-8 mt-8 pt-4 text-xs text-slate-600">
            <div className="text-center">
              <div className="border-t border-slate-400 pt-1.5">واژۆی فرۆشیار</div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 pt-1.5">واژۆی شۆفێر</div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 pt-1.5">واژۆی کڕیار</div>
            </div>
          </div>
        </div>
      </div>
      {/* PIN-protected row deletion */}
      <PinConfirmModal
        open={pendingDeleteIdx != null && !!draft && !!draft.items[pendingDeleteIdx ?? -1]}
        title="سڕینەوەی ڕیز"
        message="ئەم ڕیزە لە پسووڵەکە لادەبرێت"
        itemSummary={pendingDeleteIdx != null && draft && draft.items[pendingDeleteIdx] ? (() => {
          const it = draft.items[pendingDeleteIdx];
          const lt = (it.totalBricks ?? 0) * it.unitPrice;
          return (
            <>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">ماددەی هەڵبژێردراو</div>
              <div className="text-base font-extrabold text-slate-900 truncate">
                {it.materialName?.trim() || "— بێ ناو —"}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap" dir="ltr">
                {it.totalBricks != null && (
                  <span>خشت: <span className="tabular-nums font-semibold">{(it.totalBricks ?? 0).toLocaleString("en-US")}</span></span>
                )}
                {it.unitPrice > 0 && (
                  <><span className="text-slate-300">•</span><span>نرخ: <span className="tabular-nums font-semibold">{it.unitPrice.toLocaleString("en-US")}</span></span></>
                )}
                {lt > 0 && (
                  <><span className="text-slate-300">•</span><span>کۆ: <span className="tabular-nums font-bold text-rose-700">{lt.toLocaleString("en-US")}</span></span></>
                )}
              </div>
            </>
          );
        })() : null}
        onCancel={() => setPendingDeleteIdx(null)}
        onConfirmed={confirmRemoveRow}
      />

    </div>
  );
}
