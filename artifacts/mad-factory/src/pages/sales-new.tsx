import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { SearchableSelect } from "@/components/searchable-select";
import { AutoTextarea } from "@/components/auto-textarea";
import { PinConfirmModal } from "@/components/pin-confirm-modal";
import { CustomerLedgerSummary } from "@/components/customer-ledger-summary";
import { StatementOfAccountModal } from "@/components/statement-of-account-modal";
import {
  useCreateSalesInvoice,
  useListCustomers,
  useListMaterials,
  useListSalesInvoices,
  getListSalesInvoicesQueryKey,
  getListCustomersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  RotateCw,
  Plus,
  Save,
  X,
  ChevronsRight,
  ChevronsLeft,
  ChevronRight,
  ChevronLeft,
  FileText,
  Trash2,
  FolderOpen,
  Lock,
  LockOpen,
  Printer,
} from "lucide-react";

type InvoiceItem = {
  materialId: number | null;
  materialName: string;
  group: string;
  barcode: string;
  quantity: number | null;
  unitPrice: number;
  itemDate: string;
};

const today = () => new Date().toISOString().split("T")[0];

const emptyItem = (): InvoiceItem => ({
  materialId: null,
  materialName: "",
  group: "",
  barcode: "",
  quantity: null,
  unitPrice: 0,
  itemDate: today(),
});

// Compact MS-Access-style label/field cell.
function FieldRow({
  label, children, labelWidth = "w-24", className, alignTop,
}: {
  label: string;
  children: React.ReactNode;
  labelWidth?: string;
  className?: string;
  alignTop?: boolean;
}) {
  return (
    <div className={`flex items-stretch border border-slate-300 ${className ?? ""}`}>
      <div className={`${labelWidth} bg-cyan-100 text-slate-800 text-[12px] font-semibold flex ${alignTop ? "items-start pt-1.5" : "items-center"} justify-center px-2 border-l border-slate-300 shrink-0`}>
        {label}
      </div>
      <div className="flex-1 bg-white min-w-0">{children}</div>
    </div>
  );
}

function PlainInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-full px-2 py-1 bg-transparent border-0 outline-none text-sm ${props.className ?? ""}`}
    />
  );
}

// Single tiny row used in the bottom-left 6-stat totals stack.
function StatRow({
  label, value, accent, editable, onChange, readOnly,
}: {
  label: string;
  value: string | number;
  accent?: "muted" | "warn" | "ok";
  editable?: boolean;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  const valueColor =
    accent === "warn"
      ? "text-red-700"
      : accent === "ok"
        ? "text-emerald-700"
        : "text-slate-900";
  return (
    <div className="flex items-stretch border border-slate-300">
      <div className="w-28 bg-cyan-100 text-slate-800 text-[12px] font-semibold flex items-center px-2 border-l border-slate-300">
        {label}
      </div>
      {editable ? (
        <input
          type="number"
          value={(value as number) || ""}
          readOnly={readOnly}
          onChange={(e) => onChange?.(Number(e.target.value))}
          className={`flex-1 px-2 py-1 bg-white text-left tabular-nums outline-none text-sm font-bold ${valueColor} read-only:cursor-not-allowed`}
          placeholder="0"
          dir="ltr"
        />
      ) : (
        <div className={`flex-1 bg-white px-2 py-1 text-left tabular-nums font-bold text-sm ${valueColor}`} dir="ltr">
          {value}
        </div>
      )}
    </div>
  );
}

export default function SalesNew() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Edit lock — page is read-only until user clicks "کردنەوە"
  const [editLocked, setEditLocked] = useState(true);

  // Header / customer info
  const [customerId, setCustomerId] = useState<string>("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [searchPrev, setSearchPrev] = useState("");

  // Hidden but preserved for backend payload compatibility
  const [guarantorName] = useState("");
  const [driver] = useState("");
  const [driverMobile] = useState("");

  // Totals (only 4 are exposed in spec; percentage discount preserved internally as 0)
  const [discount, setDiscount] = useState(0);
  const discountPercent = 0;
  const [paidAmount, setPaidAmount] = useState(0);
  const [previousDebt, setPreviousDebt] = useState(0);

  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);
  const [stmtOpen, setStmtOpen] = useState(false);

  const { data: customers } = useListCustomers({}, { query: { queryKey: getListCustomersQueryKey() } });
  const { data: materials } = useListMaterials({ type: "sell" }, { query: { queryKey: ["materials", "sell"] } });
  const { data: allInvoices } = useListSalesInvoices({}, { query: { queryKey: getListSalesInvoicesQueryKey({}) } });

  useEffect(() => {
    if (!customerId) return;
    const c = customers?.find((c: { id: number }) => String(c.id) === customerId);
    if (c) {
      setCustomerMobile((c as { phone?: string | null }).phone ?? "");
      setCustomerAddress((c as { address?: string | null }).address ?? "");
    }
  }, [customerId, customers]);

  const customerInvoices = useMemo(
    () => (allInvoices ?? []).filter((i: { customerId: number }) => String(i.customerId) === customerId),
    [allInvoices, customerId],
  );

  const [postSaveAction, setPostSaveAction] = useState<"list" | "print">("list");

  const { mutate: create, isPending: creating } = useCreateSalesInvoice({
    mutation: {
      onSuccess: (response: unknown) => {
        queryClient.invalidateQueries({ queryKey: getListSalesInvoicesQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: ["cashboxSummary"] });
        const newId = (response as { id?: number | string } | undefined)?.id;
        if (postSaveAction === "print" && newId != null) {
          navigate(`/sales/${newId}?print=1`);
        } else {
          navigate("/sales");
        }
        setPostSaveAction("list");
      },
    },
  });

  const nextInvoiceNo = useMemo(
    () => String((allInvoices?.length ?? 0) + 1),
    [allInvoices],
  );

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number | null) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        if (field === "materialId") {
          if (value === null) {
            return { ...item, materialId: null, materialName: "", group: "", barcode: "" };
          }
          const mat = materials?.find((m: { id: number }) => m.id === Number(value));
          return {
            ...item,
            materialId: mat?.id ?? null,
            materialName: mat?.name ?? item.materialName,
            group: (mat as { category?: string | null } | undefined)?.category ?? "",
            unitPrice: mat ? Number((mat as { salePrice?: number | null; purchasePrice: number }).salePrice ?? mat.purchasePrice) : item.unitPrice,
          };
        }
        return { ...item, [field]: value };
      }),
    );
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);
  const removeRow = (idx: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const lineTotal = (it: InvoiceItem) => (it.quantity ?? 0) * it.unitPrice;

  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const percentDiscountAmount = Math.round(subtotal * (discountPercent / 100));
  const effectiveDiscount = discount + percentDiscountAmount;
  const totalAfterDiscount = subtotal - effectiveDiscount;
  const grandTotal = totalAfterDiscount + previousDebt;
  const remaining = grandTotal - paidAmount;
  const totalQuantity = items.reduce((s, i) => s + (i.quantity ?? 0), 0);

  const lastItem = items[items.length - 1];
  const canAddRow =
    !!lastItem &&
    !!lastItem.materialName &&
    (lastItem.quantity ?? 0) > 0 &&
    lastItem.unitPrice > 0;

  const resetForm = () => {
    setCustomerId("");
    setCustomerMobile("");
    setCustomerAddress("");
    setInvoiceDate(today());
    setNotes("");
    setSearchPrev("");
    setDiscount(0);
    setPaidAmount(0);
    setPreviousDebt(0);
    setItems([emptyItem()]);
  };

  const openPrevInvoice = () => {
    if (searchPrev) navigate(`/sales/${searchPrev}`);
  };

  const goToCustomerStatement = () => {
    if (customerId) navigate(`/customers/${customerId}`);
  };

  const navigateInvoice = (direction: "first" | "prev" | "next" | "last") => {
    const list = customerInvoices.length ? customerInvoices : allInvoices ?? [];
    if (!list.length) return;
    const sorted = [...list].sort((a: { id: number }, b: { id: number }) => a.id - b.id);
    const currentId = searchPrev ? Number(searchPrev) : null;
    let target = sorted[0];
    if (direction === "last") {
      target = sorted[sorted.length - 1];
    } else if (direction === "first") {
      target = sorted[0];
    } else if (direction === "prev") {
      if (currentId == null) target = sorted[sorted.length - 1];
      else {
        const idx = sorted.findIndex((x: { id: number }) => x.id === currentId);
        target = idx > 0 ? sorted[idx - 1] : sorted[0];
      }
    } else if (direction === "next") {
      if (currentId == null) target = sorted[0];
      else {
        const idx = sorted.findIndex((x: { id: number }) => x.id === currentId);
        target = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : sorted[sorted.length - 1];
      }
    }
    if (target) navigate(`/sales/${target.id}`);
  };

  const handleSubmit = () => {
    if (!customerId) return;
    const validItems = items.filter((i) => i.materialName && (i.quantity ?? 0) > 0);
    if (!validItems.length) return;
    create({
      data: {
        customerId: Number(customerId),
        invoiceDate,
        customerMobile: customerMobile || undefined,
        customerAddress: customerAddress || undefined,
        driver: driver || undefined,
        driverMobile: driverMobile || undefined,
        guarantorName: guarantorName || undefined,
        notes: notes || undefined,
        discount: effectiveDiscount,
        paidAmount,
        previousDebt,
        items: validItems.map((i) => ({
          materialId: i.materialId ?? undefined,
          materialName: i.materialName,
          quantity: i.quantity ?? 0,
          unitPrice: i.unitPrice,
          totalBricks: i.quantity ?? undefined,
          notes: i.barcode ? `بارکۆد: ${i.barcode}` : undefined,
        })),
      },
    });
  };

  return (
    <div dir="rtl" className="min-h-[calc(100vh-4rem)] bg-slate-100 -m-4 md:-m-6 p-2">
      <div className="bg-white border border-slate-400 shadow-sm rounded-sm overflow-hidden flex flex-col">
        {/* Title bar */}
        <div className="bg-emerald-300 border-b border-slate-400 py-1.5 text-center font-extrabold text-xl text-slate-800 tracking-wide">
          فرۆشتن
        </div>

        {/* === TOP HEADER : 3 columns (right / middle / left in RTL) === */}
        <div className="p-2 grid grid-cols-12 gap-2 border-b border-slate-300 bg-slate-50">
          {/* RIGHT block — Receipt No / Date / Buyer Name */}
          <div className="col-span-12 lg:col-span-4 space-y-1">
            <FieldRow label="ژمارەی وەسڵ" labelWidth="w-28">
              <PlainInput value={`${nextInvoiceNo} (جدید)`} readOnly className="font-mono font-bold text-slate-700 text-left" dir="ltr" />
            </FieldRow>
            <FieldRow label="بەروار" labelWidth="w-28">
              <PlainInput type="date" value={invoiceDate} readOnly={editLocked} onChange={(e) => setInvoiceDate(e.target.value)} dir="ltr" />
            </FieldRow>
            <FieldRow label="ناوی کڕیار" labelWidth="w-28">
              <SearchableSelect
                value={customerId}
                onChange={setCustomerId}
                disabled={editLocked}
                placeholder="گەڕان بە ناو / کۆد..."
                buttonClassName="text-sm border-0 rounded-none h-[30px]"
                options={(customers ?? []).map((c: { id: number; name: string }) => {
                  const code = String(c.id).padStart(3, "0");
                  return {
                    value: String(c.id),
                    label: c.name,
                    sub: code,
                    haystack: `${c.name} ${code}`,
                  };
                })}
              />
            </FieldRow>
          </div>

          {/* MIDDLE block — Mobile / Address / Notes */}
          <div className="col-span-12 lg:col-span-4 space-y-1">
            <FieldRow label="مۆبایل" labelWidth="w-24">
              <PlainInput value={customerMobile} readOnly={editLocked} onChange={(e) => setCustomerMobile(e.target.value)} dir="ltr" placeholder="07XX..." />
            </FieldRow>
            <FieldRow label="ناونیشان" labelWidth="w-24">
              <PlainInput value={customerAddress} readOnly={editLocked} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="ناونیشان..." />
            </FieldRow>
            <FieldRow label="تێبینی" labelWidth="w-24" alignTop>
              <AutoTextarea
                value={notes}
                readOnly={editLocked}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تێبینی..."
                minRows={1}
                maxRows={3}
                className="read-only:cursor-not-allowed text-sm"
              />
            </FieldRow>
          </div>

          {/* LEFT block — Search by receipt no */}
          <div className="col-span-12 lg:col-span-4 space-y-1">
            <FieldRow label="گەڕان بە پێی ژمارەی وەسڵ" labelWidth="w-44">
              <div className="flex h-full">
                <select
                  value={searchPrev}
                  onChange={(e) => setSearchPrev(e.target.value)}
                  className="flex-1 px-2 py-1 bg-transparent border-0 outline-none text-sm"
                >
                  <option value="">— پسووڵە —</option>
                  {(customerInvoices.length ? customerInvoices : allInvoices ?? []).map((inv: { id: number; invoiceNumber: string; invoiceDate: string }) => (
                    <option key={inv.id} value={inv.id}>
                      #{inv.invoiceNumber} — {inv.invoiceDate}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openPrevInvoice}
                  disabled={!searchPrev}
                  className="px-2 border-r border-slate-300 bg-slate-50 hover:bg-slate-100 disabled:opacity-40"
                  title="کردنەوەی پسووڵە"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </button>
              </div>
            </FieldRow>
          </div>
        </div>

        {/* === MAIN ITEMS GRID === */}
        <div className="px-2 py-2 border-b border-slate-300">
          <div className="border border-slate-400 bg-white overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                {/* Headers in DOM order (RTL renders first → rightmost):
                    گروپ | بارکۆد | ناوی مواد | دانە | نرخ | کۆی گشتی | بەروار | ژ.وەسڵ | × */}
                <tr className="bg-amber-50 text-slate-800 text-[12px]">
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[8%]">گروپ</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[12%]">بارکۆد</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[24%]">ناوی مواد</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[8%]">دانە</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[10%]">نرخ</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[14%]">کۆی گشتی</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[12%]">بەروار</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[8%]">ژ.وەسڵ</th>
                  <th className="border border-slate-400 px-1 py-1.5 font-bold w-9"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 align-middle">
                    {/* گروپ */}
                    <td className="border border-slate-400 px-2 py-1 text-center text-xs text-slate-600 bg-slate-50">
                      {item.group || "—"}
                    </td>
                    {/* بارکۆد */}
                    <td className="border border-slate-400 p-0">
                      <input
                        value={item.barcode}
                        readOnly={editLocked}
                        onChange={(e) => updateItem(idx, "barcode", e.target.value)}
                        className="w-full px-2 py-1 bg-transparent border-0 outline-none text-center font-mono text-xs read-only:cursor-not-allowed"
                        dir="ltr"
                        placeholder="—"
                      />
                    </td>
                    {/* ناوی مواد */}
                    <td className="border border-slate-400 p-0">
                      <select
                        value={item.materialId ?? ""}
                        disabled={editLocked}
                        onChange={(e) => updateItem(idx, "materialId", e.target.value || null)}
                        className="w-full px-2 py-1 bg-transparent border-0 outline-none text-sm font-medium disabled:cursor-not-allowed"
                      >
                        <option value="">— هەڵبژێرە —</option>
                        {materials?.map((m: { id: number; name: string }) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                    {/* دانە */}
                    <td className="border border-slate-400 p-0">
                      <input
                        type="number"
                        value={item.quantity ?? ""}
                        readOnly={editLocked}
                        onChange={(e) => updateItem(idx, "quantity", e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1 bg-transparent border-0 outline-none text-center tabular-nums text-blue-700 font-semibold read-only:cursor-not-allowed"
                        placeholder="0"
                      />
                    </td>
                    {/* نرخ */}
                    <td className="border border-slate-400 p-0">
                      <input
                        type="number"
                        value={item.unitPrice || ""}
                        readOnly={editLocked}
                        onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))}
                        className="w-full px-2 py-1 bg-transparent border-0 outline-none text-center tabular-nums text-blue-700 font-semibold read-only:cursor-not-allowed"
                        placeholder="0"
                        dir="ltr"
                      />
                    </td>
                    {/* کۆی گشتی */}
                    <td className="border border-slate-400 px-2 py-1 text-right tabular-nums font-bold text-slate-900 bg-slate-50" dir="ltr">
                      {lineTotal(item) ? lineTotal(item).toLocaleString("en-US") : "0"}
                    </td>
                    {/* بەروار */}
                    <td className="border border-slate-400 p-0">
                      <input
                        type="date"
                        value={item.itemDate}
                        readOnly={editLocked}
                        onChange={(e) => updateItem(idx, "itemDate", e.target.value)}
                        className="w-full px-1 py-1 bg-transparent border-0 outline-none text-center text-xs tabular-nums read-only:cursor-not-allowed"
                        dir="ltr"
                      />
                    </td>
                    {/* ژ.وەسڵ */}
                    <td className="border border-slate-400 px-2 py-1 text-center font-mono text-xs text-slate-600 bg-slate-50" dir="ltr">
                      {nextInvoiceNo}
                    </td>
                    {/* delete */}
                    <td className="border border-slate-400 p-0 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const hasData =
                            !!item.materialName ||
                            !!item.materialId ||
                            !!item.barcode ||
                            (item.quantity ?? 0) > 0 ||
                            item.unitPrice > 0;
                          if (hasData) setPendingDeleteIdx(idx);
                          else removeRow(idx);
                        }}
                        className="text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed p-1"
                        disabled={editLocked || items.length <= 1}
                        title={editLocked ? "بۆ سڕینەوە، کردنەوە دابگرە" : "سڕینەوەی ڕیز"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* === BOTTOM-LEFT FINANCIAL TOTALS (6 stacked rows) === */}
        <div className="px-2 pb-2 grid grid-cols-12 gap-2">
          <div className="col-span-12 md:col-span-5 lg:col-span-4 space-y-1">
            <StatRow label="کۆی گشتی" value={formatMoney(subtotal)} />
            <StatRow label="قەرزی کۆن" value={previousDebt} editable readOnly={editLocked} onChange={setPreviousDebt} />
            <StatRow label="پارەدان" value={paidAmount} editable readOnly={editLocked} onChange={setPaidAmount} accent="ok" />
            <StatRow label="داشکاندن" value={discount} editable readOnly={editLocked} onChange={setDiscount} />
            <StatRow label="قەرزی ماوە" value={formatMoney(remaining)} accent={remaining > 0 ? "warn" : "ok"} />
            <StatRow label="کۆی دانە" value={totalQuantity.toLocaleString("en-US")} />
            <div className="grid grid-cols-2 gap-1 pt-1">
              <Button
                type="button"
                disabled={editLocked}
                onClick={() => setPaidAmount(grandTotal)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs shadow-sm"
                title="پارەدانی تەواوی قەرز (کۆی گشتی + قەرزی کۆن − داشکاندن)"
              >
                پارەدانی تەواو
              </Button>
              <Button
                type="button"
                disabled={editLocked}
                onClick={() => setPaidAmount(totalAfterDiscount)}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold h-8 text-xs shadow-sm"
                title="تەنها بڕی ئەم وەسڵە دوای داشکاندن (بەبێ قەرزی کۆن)"
              >
                پارەدانی دوای داشکاندن
              </Button>
            </div>
          </div>

          {/* Customer ledger summary on the right side of the totals */}
          <div className="col-span-12 md:col-span-7 lg:col-span-8">
            <CustomerLedgerSummary
              customerId={customerId ? Number(customerId) : null}
              currentInvoiceTotal={totalAfterDiscount}
              currentPayment={paidAmount}
            />
          </div>
        </div>

        {/* === BOTTOM ACTION TOOLBAR === */}
        <div className="border-t border-slate-400 bg-slate-50 px-2 py-1.5 flex flex-wrap items-center gap-1.5 justify-center">
          {/* Right→left visual order in RTL: Add | Refresh | Nav | Big Receipt | Open | Close | Statement */}
          <Button
            type="button"
            onClick={addRow}
            disabled={editLocked || !canAddRow}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-1 shadow-sm h-8 px-3"
            title={editLocked ? "بۆ زیادکردن، سەرەتا کردنەوە دابگرە" : !canAddRow ? "سەرەتا ڕیزی پێشوو پڕبکەرەوە" : "زیادکردنی ڕیز"}
          >
            <Plus className="h-4 w-4" /> زیاد کردن
          </Button>

          <Button
            type="button"
            onClick={resetForm}
            disabled={editLocked}
            className="bg-emerald-400 hover:bg-emerald-500 text-white font-bold gap-1 shadow-sm h-8 px-3"
          >
            <RotateCw className="h-4 w-4" /> ڕیفرێش
          </Button>

          <div className="flex items-center gap-0.5 border-x border-slate-400 px-1.5">
            <Button type="button" variant="outline" size="icon" onClick={() => navigateInvoice("first")} className="h-7 w-7 border-slate-400" title="یەکەم">
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => navigateInvoice("prev")} className="h-7 w-7 border-slate-400" title="پێشوو">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => navigateInvoice("next")} className="h-7 w-7 border-slate-400" title="دواتر">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => navigateInvoice("last")} className="h-7 w-7 border-slate-400" title="کۆتایی">
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => { setPostSaveAction("print"); handleSubmit(); }}
            disabled={editLocked || creating || !customerId}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 shadow-sm h-8 px-3"
            title="پاشەکەوت + کردنەوە بە شێوەی وەسڵی A4 بۆ چاپ"
          >
            <Printer className="h-4 w-4" /> وەسڵ - گەورە
          </Button>

          <Button
            type="button"
            onClick={() => setEditLocked((v) => !v)}
            className={`${
              editLocked
                ? "bg-pink-400 hover:bg-pink-500 text-red-900 border border-red-700"
                : "bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-800"
            } font-bold gap-1 shadow-sm h-8 px-3`}
            title={editLocked ? "کردنەوە بۆ دەستکاری" : "داخستنی دەستکاری"}
          >
            {editLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            کردنەوە
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/sales")}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold gap-1 border-slate-400 h-8 px-3"
          >
            <X className="h-4 w-4" /> داخستن
          </Button>

          <Button
            type="button"
            onClick={goToCustomerStatement}
            disabled={!customerId}
            className="bg-orange-400 hover:bg-orange-500 text-white font-bold gap-1 shadow-sm h-8 px-3"
          >
            <FileText className="h-4 w-4" /> کەشف حسابی کڕیار
          </Button>

          {/* Save button — kept separate as primary action */}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={editLocked || creating || !customerId}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1 shadow-sm h-8 px-3 min-w-[100px]"
            title={editLocked ? "بۆ پاشەکەوت، کردنەوە دابگرە" : "پاشەکەوت"}
          >
            <Save className="h-4 w-4" /> {creating ? "تۆمارکردن..." : "پاشەکەوت"}
          </Button>
        </div>
      </div>

      {/* Statement of Account modal */}
      <StatementOfAccountModal
        open={stmtOpen}
        onClose={() => setStmtOpen(false)}
        kind="customer"
        entityId={customerId ? Number(customerId) : null}
      />

      {/* PIN-protected row deletion */}
      <PinConfirmModal
        open={pendingDeleteIdx != null && !!items[pendingDeleteIdx ?? -1]}
        title="سڕینەوەی ڕیز"
        message="ئەم ڕیزە لە پسووڵەکە لادەبرێت"
        itemSummary={pendingDeleteIdx != null && items[pendingDeleteIdx] ? (
          <>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">ماددەی هەڵبژێردراو</div>
            <div className="text-base font-extrabold text-slate-900 truncate">
              {items[pendingDeleteIdx].materialName?.trim() || "— بێ ناو —"}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap" dir="ltr">
              {(items[pendingDeleteIdx].quantity ?? 0) > 0 && (
                <span>دانە: <span className="tabular-nums font-semibold">{(items[pendingDeleteIdx].quantity ?? 0).toLocaleString("en-US")}</span></span>
              )}
              {items[pendingDeleteIdx].unitPrice > 0 && (
                <><span className="text-slate-300">•</span><span>نرخ: <span className="tabular-nums font-semibold">{items[pendingDeleteIdx].unitPrice.toLocaleString("en-US")}</span></span></>
              )}
              {lineTotal(items[pendingDeleteIdx]) > 0 && (
                <><span className="text-slate-300">•</span><span>کۆ: <span className="tabular-nums font-bold text-rose-700">{lineTotal(items[pendingDeleteIdx]).toLocaleString("en-US")}</span></span></>
              )}
            </div>
          </>
        ) : null}
        onCancel={() => setPendingDeleteIdx(null)}
        onConfirmed={() => {
          if (pendingDeleteIdx != null) removeRow(pendingDeleteIdx);
          setPendingDeleteIdx(null);
        }}
      />
    </div>
  );
}
