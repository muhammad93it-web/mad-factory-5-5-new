import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { useCreatePurchaseInvoice, useListSuppliers, useListMaterials, useGetLatestExchangeRate, getListPurchaseInvoicesQueryKey, getListSuppliersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Truck, Plus, Trash2, ArrowRight } from "lucide-react";
import { QuickAddParty } from "@/components/quick-add-party";
import { SearchableSelect } from "@/components/searchable-select";
import { AutoTextarea } from "@/components/auto-textarea";
import { PinConfirmModal } from "@/components/pin-confirm-modal";
import { StatementOfAccountModal } from "@/components/statement-of-account-modal";
import { BookOpen } from "lucide-react";

type InvoiceItem = {
  materialId: number | null;
  materialName: string;
  quantity: number;
  unitPrice: number;
  palletCount: number | null;
  bricksPerPallet: number | null;
  totalBricks: number | null;
  notes: string;
};

const emptyItem = (): InvoiceItem => ({
  materialId: null,
  materialName: "",
  quantity: 0,
  unitPrice: 0,
  palletCount: null,
  bricksPerPallet: null,
  totalBricks: null,
  notes: "",
});

export default function PurchasesNew() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [supplierId, setSupplierId] = useState("");
  const [stmtOpen, setStmtOpen] = useState(false);
  const [supplierMobile, setSupplierMobile] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [currency, setCurrency] = useState<"IQD" | "USD">("IQD");
  const [driver, setDriver] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [guarantorName, setGuarantorName] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [previousDebt, setPreviousDebt] = useState(0);
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);

  const { data: suppliers } = useListSuppliers({}, { query: { queryKey: getListSuppliersQueryKey() } });
  // Purchases screen — only show items configured as buyable (buy or both)
  const { data: materials } = useListMaterials({ type: "buy" }, { query: { queryKey: ["materials", "buy"] } });

  // Pretty PIN-protected delete confirmation for line items
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);

  const supplierOptions = useMemo(
    () =>
      (suppliers ?? []).map((s: { id: number; name: string; phone?: string | null }) => ({
        value: String(s.id),
        label: s.name,
        sub: String(s.id).padStart(3, "0"),
        haystack: `${s.name} ${String(s.id).padStart(3, "0")} ${s.phone ?? ""}`,
      })),
    [suppliers],
  );
  const { data: latestRate } = useGetLatestExchangeRate({ query: { queryKey: ["exchangeRate", "latest"] } });

  const { mutate: create, isPending: creating } = useCreatePurchaseInvoice({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPurchaseInvoicesQueryKey({}) });
        navigate("/purchases");
      },
    },
  });

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number | null) => {
    setItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item;
      let next: InvoiceItem;
      if (field === "materialId") {
        const mat = materials?.find((m) => m.id === Number(value));
        next = {
          ...item,
          materialId: mat?.id ?? null,
          materialName: mat?.name ?? item.materialName,
          unitPrice: mat ? Number(mat.purchasePrice) : item.unitPrice,
          bricksPerPallet: mat?.bricksPerPallet ?? item.bricksPerPallet,
        };
      } else {
        next = { ...item, [field]: value };
      }
      if (next.palletCount != null && next.bricksPerPallet != null) {
        next.totalBricks = Number((next.palletCount * next.bricksPerPallet).toFixed(2));
      }
      return next;
    }));
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const total = subtotal - discount;
  const grandTotal = total + previousDebt;
  const remaining = grandTotal - paidAmount;
  const rate = latestRate ? Number(latestRate.rate) : 1480;
  const fmt = (v: number) => currency === "IQD" ? formatMoney(v) : `${v.toLocaleString()} $`;

  const handleSubmit = () => {
    if (!supplierId) return;
    create({
      data: {
        supplierId: Number(supplierId),
        invoiceDate,
        currency,
        exchangeRateId: latestRate?.id,
        supplierMobile: supplierMobile || undefined,
        supplierAddress: supplierAddress || undefined,
        driver: driver || undefined,
        driverMobile: driverMobile || undefined,
        vehicle: vehicle || undefined,
        guarantorName: guarantorName || undefined,
        notes: notes || undefined,
        discount,
        paidAmount,
        previousDebt,
        items: items.filter((i) => i.materialName && i.quantity > 0).map((i) => ({
          materialId: i.materialId ?? undefined,
          materialName: i.materialName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          palletCount: i.palletCount ?? undefined,
          bricksPerPallet: i.bricksPerPallet ?? undefined,
          totalBricks: i.totalBricks ?? undefined,
          notes: i.notes || undefined,
        })),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          پسووڵەی کڕینی نوێ
        </h1>
        <Button variant="outline" onClick={() => navigate("/purchases")} className="gap-2">
          <ArrowRight className="h-4 w-4" />
          گەڕانەوە
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3 border-b"><CardTitle className="text-base">زانیاری دابینکار و پسووڵە</CardTitle></CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div>
              <Label>دابینکار *</Label>
              <div className="flex gap-2 mt-1">
                <div className="flex-1 border rounded bg-white dark:bg-slate-900 min-h-[40px] flex items-center">
                  <SearchableSelect
                    value={supplierId}
                    onChange={setSupplierId}
                    options={supplierOptions}
                    placeholder="گەڕان بە ناو / کۆد / مۆبایل..."
                    className="w-full"
                    buttonClassName="text-sm py-2"
                  />
                </div>
                <QuickAddParty kind="supplier" onCreated={(id) => setSupplierId(String(id))} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStmtOpen(true)}
                  disabled={!supplierId}
                  className="gap-1 bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200 text-xs font-bold"
                  title="کەشف حساب"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  کەشف حساب
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>مۆبایلی دابینکار</Label>
                <Input value={supplierMobile} onChange={(e) => setSupplierMobile(e.target.value)} placeholder="07XX..." dir="ltr" />
              </div>
              <div>
                <Label>بەروار</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>ناونیشانی دابینکار</Label>
              <Input value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} placeholder="ناونیشان..." />
            </div>
            <div>
              <Label>دراو</Label>
              <div className="flex gap-2 mt-1">
                {(["IQD", "USD"] as const).map((c) => (
                  <button key={c} onClick={() => setCurrency(c)} className={`flex-1 py-2 rounded border font-medium transition-colors ${currency === c ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-900 text-slate-600 hover:border-primary'}`}>
                    {c === "IQD" ? "دینار (د.ع)" : "دۆلار ($)"}
                  </button>
                ))}
              </div>
              {currency === "USD" && (
                <div className="mt-2 text-sm text-slate-500 bg-slate-50 rounded px-3 py-2" dir="ltr">
                  نرخی دۆلار: 1 USD = {rate.toLocaleString()} IQD
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>شوفێر</Label>
                <Input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="ناوی شوفێر..." />
              </div>
              <div>
                <Label>مۆبایلی شوفێر</Label>
                <Input value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} placeholder="07XX..." dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ئۆتۆمبێل</Label>
                <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="ژمارەی ئۆتۆمبێل..." dir="ltr" />
              </div>
              <div>
                <Label>کەفیل</Label>
                <Input value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)} placeholder="ناوی کەفیل..." />
              </div>
            </div>
            <div>
              <Label>تێبینی</Label>
              <div className="border rounded bg-white dark:bg-slate-900 px-1 mt-1">
                <AutoTextarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تێبینی..." minRows={2} maxRows={8} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b"><CardTitle className="text-base">پوختەی پارەدان</CardTitle></CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">کۆی پسووڵە ({currency}):</span>
              <span className="font-bold text-lg">{fmt(subtotal)}</span>
            </div>
            {currency === "USD" && (
              <div className="flex justify-between items-center py-2 text-sm text-slate-500">
                <span>بەرامبەری (د.ع):</span>
                <span>{formatMoney(subtotal * rate)}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Label className="shrink-0">داشکاندن:</Label>
              <Input type="number" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value))} placeholder="0" />
            </div>
            <div className="flex items-center gap-3">
              <Label className="shrink-0">قەرزی پێشوو:</Label>
              <Input type="number" value={previousDebt || ""} onChange={(e) => setPreviousDebt(Number(e.target.value))} placeholder="0" />
            </div>
            <div className="flex justify-between items-center py-2 border-t font-bold">
              <span>کۆی گشتی:</span>
              <span className="text-xl">{fmt(grandTotal)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Label className="shrink-0">دراوە:</Label>
              <Input type="number" value={paidAmount || ""} onChange={(e) => setPaidAmount(Number(e.target.value))} placeholder="0" />
            </div>
            <div className={`flex justify-between items-center py-3 px-4 rounded-lg ${remaining > 0 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
              <span className="font-bold">قەرزی ماوە:</span>
              <span className={`font-bold text-xl ${remaining > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{fmt(remaining)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">بڕگەکانی پسووڵە</CardTitle>
            <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
              <Plus className="h-3 w-3" />
              بڕگەی نوێ
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <div className="grid gap-2 text-xs font-medium text-slate-500 px-1" style={{ gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr 1fr 1fr 0.5fr" }}>
              <div>ناوی شت</div>
              <div>بڕ</div>
              <div>پاڵەت</div>
              <div>خشت/پاڵەت</div>
              <div>کۆی خشت</div>
              <div>نرخی یەک ({currency})</div>
              <div>کۆ</div>
              <div></div>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid gap-2 items-center bg-slate-50 dark:bg-slate-800/50 rounded-lg px-3 py-2" style={{ gridTemplateColumns: "3fr 1fr 1fr 1fr 1fr 1fr 1fr 0.5fr" }}>
                <div>
                  <select value={item.materialId ?? ""} onChange={(e) => {
                    if (e.target.value === "__custom__") updateItem(idx, "materialId", null);
                    else if (e.target.value) updateItem(idx, "materialId", e.target.value);
                  }} className="w-full border rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-900">
                    <option value="">هەڵبژێرە...</option>
                    {materials?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    <option value="__custom__">--- ناوی دیکە ---</option>
                  </select>
                  {!item.materialId && (
                    <Input placeholder="ناوی شت..." value={item.materialName} onChange={(e) => updateItem(idx, "materialName", e.target.value)} className="mt-1 text-sm h-8" />
                  )}
                </div>
                <div><Input type="number" value={item.quantity || ""} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} placeholder="0" className="text-sm h-8" /></div>
                <div><Input type="number" step="0.5" value={item.palletCount ?? ""} onChange={(e) => updateItem(idx, "palletCount", e.target.value ? Number(e.target.value) : null)} placeholder="-" className="text-sm h-8" /></div>
                <div><Input type="number" value={item.bricksPerPallet ?? ""} onChange={(e) => updateItem(idx, "bricksPerPallet", e.target.value ? Number(e.target.value) : null)} placeholder="-" className="text-sm h-8" /></div>
                <div><Input type="number" value={item.totalBricks ?? ""} onChange={(e) => updateItem(idx, "totalBricks", e.target.value ? Number(e.target.value) : null)} placeholder="-" className="text-sm h-8" /></div>
                <div><Input type="number" value={item.unitPrice || ""} onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))} placeholder="0" className="text-sm h-8" /></div>
                <div className="text-sm font-bold text-right">{(item.quantity * item.unitPrice).toLocaleString()}</div>
                <div className="flex justify-end">
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => {
                        // Empty rows can be removed without confirmation; rows with data require PIN.
                        const hasData =
                          !!item.materialName ||
                          !!item.materialId ||
                          item.quantity > 0 ||
                          item.unitPrice > 0 ||
                          (item.palletCount ?? 0) > 0 ||
                          (item.bricksPerPallet ?? 0) > 0 ||
                          (item.totalBricks ?? 0) > 0;
                        if (hasData) setPendingDeleteIdx(idx);
                        else removeItem(idx);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-6 gap-3">
            <Button variant="outline" onClick={() => navigate("/purchases")}>هەڵوەشاندنەوە</Button>
            <Button onClick={handleSubmit} disabled={creating || !supplierId} className="min-w-32">
              {creating ? "تۆمارکردن..." : "پاشەکەوتکردنی پسووڵە"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PIN-protected line-row deletion */}
      <PinConfirmModal
        open={pendingDeleteIdx != null && !!items[pendingDeleteIdx ?? -1]}
        title="سڕینەوەی بڕگە"
        message="ئەم بڕگەیە لە پسووڵەکە لادەبرێت"
        itemSummary={pendingDeleteIdx != null && items[pendingDeleteIdx] ? (
          <>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">بڕگەی هەڵبژێردراو</div>
            <div className="text-base font-extrabold text-slate-900 truncate">
              {items[pendingDeleteIdx].materialName?.trim() || "— بێ ناو —"}
            </div>
          </>
        ) : null}
        onCancel={() => setPendingDeleteIdx(null)}
        onConfirmed={() => {
          if (pendingDeleteIdx != null) removeItem(pendingDeleteIdx);
          setPendingDeleteIdx(null);
        }}
      />

      <StatementOfAccountModal
        open={stmtOpen}
        onClose={() => setStmtOpen(false)}
        kind="supplier"
        entityId={supplierId ? Number(supplierId) : null}
      />
    </div>
  );
}
