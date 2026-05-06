import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { SearchableSelect } from "@/components/searchable-select";
import { AutoTextarea } from "@/components/auto-textarea";
import { PinConfirmModal } from "@/components/pin-confirm-modal";
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
  Eye,
} from "lucide-react";

type InvoiceItem = {
  materialId: number | null;
  materialName: string;
  bricksPerPallet: number | null;   // عدد فی بالێت
  pallets: number | null;            // عدد بالێت
  unitPrice: number;                 // السعر
  itemDate: string;                  // تاریخ الحمل
};

const today = () => new Date().toISOString().split("T")[0];

const emptyItem = (): InvoiceItem => ({
  materialId: null,
  materialName: "",
  bricksPerPallet: null,
  pallets: null,
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

// Bilingual stat row used in the bottom-left totals stack.
// Right column = bilingual label (Kurdish/Arabic), left = value with optional د.ع suffix.
function StatRow({
  labelKu, labelAr, value, accent, editable, onChange, readOnly, suffix, labelClassName, valueClassName, labelWidth,
}: {
  labelKu: string;
  labelAr?: string;
  value: string | number;
  accent?: "muted" | "warn" | "ok";
  editable?: boolean;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  suffix?: string;
  labelClassName?: string;
  valueClassName?: string;
  labelWidth?: string;
}) {
  const valueColor =
    accent === "warn"
      ? "text-red-700"
      : accent === "ok"
        ? "text-emerald-700"
        : "text-slate-900";
  return (
    <div className="flex items-stretch border border-slate-300 min-h-[28px]">
      <div className={`${labelWidth ?? "w-44"} text-slate-800 text-[12px] font-semibold flex items-center justify-end px-2 border-l border-slate-300 shrink-0 ${labelClassName ?? "bg-cyan-100"}`}>
        <span className="truncate">
          {labelKu}
          {labelAr ? <span className="text-slate-500 font-normal"> / {labelAr}</span> : null}
        </span>
      </div>
      {editable ? (
        <div className={`flex-1 flex items-stretch ${valueClassName ?? "bg-white"}`}>
          <input
            type="number"
            value={(value as number) || ""}
            readOnly={readOnly}
            onChange={(e) => onChange?.(Number(e.target.value))}
            className={`flex-1 px-2 py-1 bg-transparent text-left tabular-nums outline-none text-sm font-bold ${valueColor} read-only:cursor-not-allowed min-w-0`}
            placeholder="0"
            dir="ltr"
          />
          {suffix ? <span className="px-2 flex items-center text-[11px] text-slate-500">{suffix}</span> : null}
        </div>
      ) : (
        <div className={`flex-1 px-2 py-1 text-left tabular-nums font-bold text-sm ${valueColor} flex items-center justify-between ${valueClassName ?? "bg-white"}`} dir="ltr">
          <span className="truncate">{value}</span>
          {suffix ? <span className="text-[11px] text-slate-500 ms-2 shrink-0">{suffix}</span> : null}
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

  // Header second row — guarantor & driver info (now visible)
  const [guarantorName, setGuarantorName] = useState("");
  const [driver, setDriver] = useState("");
  const [driverMobile, setDriverMobile] = useState("");

  // Totals
  const [discount, setDiscount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
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
            return { ...item, materialId: null, materialName: "" };
          }
          const mat = materials?.find((m: { id: number }) => m.id === Number(value)) as
            | { id: number; name: string; salePrice?: number | null; purchasePrice: number; bricksPerPallet?: number | null }
            | undefined;
          return {
            ...item,
            materialId: mat?.id ?? null,
            materialName: mat?.name ?? item.materialName,
            unitPrice: mat ? Number(mat.salePrice ?? mat.purchasePrice) : item.unitPrice,
            bricksPerPallet: mat?.bricksPerPallet ?? item.bricksPerPallet,
          };
        }
        return { ...item, [field]: value };
      }),
    );
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);
  const removeRow = (idx: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const itemBricks = (it: InvoiceItem) => (it.pallets ?? 0) * (it.bricksPerPallet ?? 0);
  const lineTotal = (it: InvoiceItem) => itemBricks(it) * it.unitPrice;

  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  const percentDiscountAmount = Math.round(subtotal * (discountPercent / 100));
  const effectiveDiscount = discount + percentDiscountAmount;
  const totalAfterDiscount = subtotal - effectiveDiscount;
  const grandTotal = totalAfterDiscount + previousDebt;
  const remaining = grandTotal - paidAmount;
  const totalPallets = items.reduce((s, i) => s + (i.pallets ?? 0), 0);
  const totalBricks = items.reduce((s, i) => s + itemBricks(i), 0);

  const lastItem = items[items.length - 1];
  const canAddRow =
    !!lastItem &&
    !!lastItem.materialName &&
    (lastItem.pallets ?? 0) > 0 &&
    (lastItem.bricksPerPallet ?? 0) > 0 &&
    lastItem.unitPrice > 0;

  const resetForm = () => {
    setCustomerId("");
    setCustomerMobile("");
    setCustomerAddress("");
    setInvoiceDate(today());
    setNotes("");
    setSearchPrev("");
    setGuarantorName("");
    setDriver("");
    setDriverMobile("");
    setDiscount(0);
    setDiscountPercent(0);
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
    const validItems = items.filter((i) => i.materialName && (i.pallets ?? 0) > 0 && (i.bricksPerPallet ?? 0) > 0);
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
          quantity: itemBricks(i),
          unitPrice: i.unitPrice,
          totalBricks: itemBricks(i),
          notes: `بالێت: ${i.pallets} × ${i.bricksPerPallet}`,
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

        {/* === TOP HEADER : 4 rows === */}
        <div className="p-2 space-y-1 border-b border-slate-300 bg-slate-50">
          {/* Row 1 (RTL right→left): ژ.وەسڵ | کۆد/کڕیار | بەروار | مۆبایل */}
          <div className="grid grid-cols-12 gap-1">
            <div className="col-span-6 sm:col-span-3 lg:col-span-2">
              <FieldRow label="ژ.وەسڵ" labelWidth="w-20">
                <PlainInput value={nextInvoiceNo} readOnly className="font-mono font-bold text-slate-700 text-center" dir="ltr" />
              </FieldRow>
            </div>
            <div className="col-span-6 sm:col-span-3 lg:col-span-3">
              <FieldRow label="کۆد/کڕیار" labelWidth="w-24">
                <PlainInput
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  readOnly={editLocked}
                  placeholder="کۆد..."
                  dir="ltr"
                  className="text-center font-mono"
                />
              </FieldRow>
            </div>
            <div className="col-span-6 sm:col-span-3 lg:col-span-4">
              <FieldRow label="بەروار" labelWidth="w-20">
                <PlainInput type="date" value={invoiceDate} readOnly={editLocked} onChange={(e) => setInvoiceDate(e.target.value)} dir="ltr" />
              </FieldRow>
            </div>
            <div className="col-span-6 sm:col-span-3 lg:col-span-3">
              <FieldRow label="مۆبایل" labelWidth="w-20">
                <PlainInput value={customerMobile} readOnly={editLocked} onChange={(e) => setCustomerMobile(e.target.value)} dir="ltr" placeholder="07XX..." />
              </FieldRow>
            </div>
          </div>

          {/* Row 2: ناوی کەفیل | ناونیشان | ناوی شۆفێر | ز.م.شۆفێر */}
          <div className="grid grid-cols-12 gap-1">
            <div className="col-span-6 sm:col-span-3">
              <FieldRow label="ناوی کەفیل" labelWidth="w-24">
                <PlainInput value={guarantorName} readOnly={editLocked} onChange={(e) => setGuarantorName(e.target.value)} placeholder="ناوی کەفیل..." />
              </FieldRow>
            </div>
            <div className="col-span-6 sm:col-span-3">
              <FieldRow label="ناونیشان" labelWidth="w-24">
                <PlainInput value={customerAddress} readOnly={editLocked} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="ناونیشان..." />
              </FieldRow>
            </div>
            <div className="col-span-6 sm:col-span-3">
              <FieldRow label="ناوی شۆفێر" labelWidth="w-24">
                <PlainInput value={driver} readOnly={editLocked} onChange={(e) => setDriver(e.target.value)} placeholder="ناوی شۆفێر..." />
              </FieldRow>
            </div>
            <div className="col-span-6 sm:col-span-3">
              <FieldRow label="ز.م.شۆفێر" labelWidth="w-24">
                <PlainInput value={driverMobile} readOnly={editLocked} onChange={(e) => setDriverMobile(e.target.value)} dir="ltr" placeholder="07XX..." />
              </FieldRow>
            </div>
          </div>

          {/* Row 3: اسم/کڕیار (autocomplete) | کەشف حساب | dropdown — پسوولە — | گەڕان بەپێی ژ.وەسڵ */}
          <div className="grid grid-cols-12 gap-1">
            <div className="col-span-12 lg:col-span-6">
              <FieldRow label="اسم/کڕیار" labelWidth="w-24">
                <SearchableSelect
                  value={customerId}
                  onChange={setCustomerId}
                  disabled={editLocked}
                  placeholder="گەڕان بە ناو / کۆد / ژ.وەسڵ..."
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
            <div className="col-span-12 lg:col-span-6">
              <div className="flex items-stretch border border-slate-300 h-full">
                <button
                  type="button"
                  onClick={() => setStmtOpen(true)}
                  disabled={!customerId}
                  className="bg-cyan-100 hover:bg-cyan-200 text-slate-800 text-[12px] font-semibold px-3 border-l border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
                  title="کەشف حسابی کڕیار"
                >
                  <FileText className="h-3.5 w-3.5" />
                  کەشف حساب
                </button>
                <select
                  value={searchPrev}
                  onChange={(e) => setSearchPrev(e.target.value)}
                  className="flex-1 px-2 py-1 bg-white border-0 outline-none text-sm border-l border-slate-300"
                >
                  <option value="">— پسوولە —</option>
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
                  className="bg-cyan-100 hover:bg-cyan-200 text-slate-800 text-[12px] font-semibold px-3 border-r border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
                  title="گەڕان بەپێی ژ.وەسڵ"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  گەڕان بەپێی ژ.وەسڵ
                </button>
              </div>
            </div>
          </div>

          {/* Row 4: تێبینی (full width) */}
          <FieldRow label="تێبینی" labelWidth="w-20" alignTop>
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

        {/* === MIDDLE SECTION: side-by-side table (75%) + calc panel (25%) === */}
        <div className="px-2 py-2 border-b border-slate-300 grid grid-cols-1 lg:grid-cols-4 gap-2">
          {/* RIGHT (in RTL = first): items table — 75% / 3 cols of 4 */}
          <div className="lg:col-span-3 order-1 border border-slate-400 bg-white overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                {/* Headers in DOM order (RTL renders first → rightmost):
                    ناوی/اسم المواد | عدد فی بالێت | عدد بالێت | جمع طابوق | السعر | جمع کل | تاریخ الحمل | × */}
                <tr className="bg-amber-50 text-slate-800 text-[12px]">
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[24%]">ناوی/اسم المواد</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[10%]">عدد بالێت</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[12%]">عدد فی بالێت</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[12%]">جمع طابوق</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[10%]">السعر</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[14%]">جمع کل</th>
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[14%]">تاریخ الحمل</th>
                  <th className="border border-slate-400 px-1 py-1.5 font-bold w-9"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 align-middle">
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
                    {/* عدد بالێت */}
                    <td className="border border-slate-400 p-0">
                      <input
                        type="number"
                        value={item.pallets ?? ""}
                        readOnly={editLocked}
                        onChange={(e) => updateItem(idx, "pallets", e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1 bg-transparent border-0 outline-none text-center tabular-nums text-blue-700 font-semibold read-only:cursor-not-allowed"
                        placeholder="0"
                      />
                    </td>
                    {/* عدد فی بالێت */}
                    <td className="border border-slate-400 p-0">
                      <input
                        type="number"
                        value={item.bricksPerPallet ?? ""}
                        readOnly={editLocked}
                        onChange={(e) => updateItem(idx, "bricksPerPallet", e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1 bg-transparent border-0 outline-none text-center tabular-nums text-blue-700 font-semibold read-only:cursor-not-allowed"
                        placeholder="0"
                      />
                    </td>
                    {/* جمع طابوق */}
                    <td className="border border-slate-400 px-2 py-1 text-center tabular-nums font-bold text-slate-700 bg-slate-50">
                      {itemBricks(item) ? itemBricks(item).toLocaleString("en-US") : "—"}
                    </td>
                    {/* السعر */}
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
                    {/* جمع کل */}
                    <td className="border border-slate-400 px-2 py-1 text-right tabular-nums font-bold text-slate-900 bg-slate-50" dir="ltr">
                      {lineTotal(item) ? lineTotal(item).toLocaleString("en-US") : "0"}
                    </td>
                    {/* تاریخ الحمل */}
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
                    {/* delete */}
                    <td className="border border-slate-400 p-0 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const hasData =
                            !!item.materialName ||
                            !!item.materialId ||
                            (item.pallets ?? 0) > 0 ||
                            (item.bricksPerPallet ?? 0) > 0 ||
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

          {/* LEFT (in RTL = last): calc panel — 25% / 1 col of 4 */}
          <div className="lg:col-span-1 order-2 space-y-1">
            <StatRow labelKu="کۆی گشتی" labelAr="جمع کل" value={formatMoney(subtotal)} suffix="د.ع" labelWidth="w-32" />
            <StatRow labelKu="قەرزی کۆن" labelAr="الدین" value={previousDebt} editable readOnly={editLocked} onChange={setPreviousDebt} labelWidth="w-32" />
            <StatRow labelKu="پارەدان" labelAr="الواصلات" value={paidAmount} editable readOnly={editLocked} onChange={setPaidAmount} accent="ok" labelWidth="w-32" />
            {/* Quick-pay buttons: pay-after-discount | pay-full-subtotal */}
            <div className="flex items-stretch border border-red-300 min-h-[26px]">
              <button
                type="button"
                onClick={() => setPaidAmount(Math.max(0, totalAfterDiscount))}
                title="پارەدانی تەواو دوای داشکاندن"
                className="w-32 bg-white hover:bg-red-100 active:bg-red-200 text-red-700 text-[10px] font-bold flex items-center justify-end px-2 border-l border-red-300 shrink-0 transition-colors cursor-pointer"
              >
                % = دوای داشکاندن
              </button>
              <button
                type="button"
                onClick={() => setPaidAmount(Math.max(0, subtotal))}
                title="پارەدانی تەواو بێ داشکاندن"
                className="flex-1 bg-white hover:bg-red-100 active:bg-red-200 text-red-700 text-[10px] font-bold flex items-center justify-start px-2 transition-colors cursor-pointer"
              >
                کۆی گشتی
              </button>
            </div>
            <StatRow labelKu="داشکاندن" value={discount} editable readOnly={editLocked} onChange={setDiscount} labelWidth="w-32" />
            <StatRow labelKu="داشکاندنی ڕێژەیی (%)" value={discountPercent} editable readOnly={editLocked} onChange={setDiscountPercent} suffix="%" valueClassName="bg-amber-50" labelWidth="w-32" />
            <StatRow labelKu="قەرزی ماوە" value={formatMoney(remaining)} accent={remaining > 0 ? "warn" : "ok"} suffix="د.ع" labelWidth="w-32" />
            <StatRow labelKu="کۆی بالێت" value={totalPallets.toLocaleString("en-US")} labelWidth="w-32" />
            <StatRow labelKu="کۆی خشت" value={totalBricks.toLocaleString("en-US")} labelWidth="w-32" />
          </div>
        </div>

        {/* === BOTTOM TOTALS BAR (4 summary boxes spanning full width) === */}
        <div className="px-2 pb-2 grid grid-cols-12 gap-2">
          {/* Left side: 3 stacked summary rows with wide colored labels */}
          <div className="col-span-12 lg:col-span-7 space-y-1">
            <StatRow labelKu="فرۆش" labelAr="جمع کل المبیعات" value={formatMoney(subtotal)} suffix="د.ع" labelClassName="bg-violet-200" labelWidth="flex-1" />
            <StatRow labelKu="پارەدان" labelAr="جمع کل الواصلات" value={formatMoney(paidAmount)} suffix="د.ع" labelClassName="bg-emerald-200" labelWidth="flex-1" />
            <StatRow labelKu="فەرز" labelAr="باقی الحساب" value={formatMoney(remaining)} accent={remaining > 0 ? "warn" : "ok"} suffix="د.ع" labelClassName="bg-amber-200" labelWidth="flex-1" />
          </div>
          {/* Right side: single big total */}
          <div className="col-span-12 lg:col-span-5">
            <div className="flex items-stretch border border-slate-300 h-full min-h-[92px]">
              <div className="flex-1 bg-violet-200 text-slate-800 text-[13px] font-semibold flex items-center justify-end px-3 border-l border-slate-300 text-right">
                کۆی ئەم پسوولە / جمع الکل الفاتورە
              </div>
              <div className="w-40 bg-white px-3 flex items-center justify-between" dir="ltr">
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{formatMoney(totalAfterDiscount)}</span>
                <span className="text-sm text-slate-500">د.ع</span>
              </div>
            </div>
          </div>
        </div>

        {/* === BOTTOM ACTION TOOLBAR === */}
        <div className="border-t border-slate-400 bg-slate-50 px-2 py-1.5 flex flex-wrap items-center gap-1.5 justify-center">
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
            <Printer className="h-4 w-4" /> وەسڵی گەورە A4
          </Button>

          <Button
            type="button"
            onClick={() => { if (searchPrev) navigate(`/sales/${searchPrev}`); }}
            disabled={!searchPrev}
            className="bg-sky-500 hover:bg-sky-600 text-white font-bold gap-1 shadow-sm h-8 px-3"
            title="بینینی پسوولەی هەڵبژێردراو"
          >
            <Eye className="h-4 w-4" /> بینینی پسوولە
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
        </div>

        {/* Save button — full width, primary action */}
        <div className="border-t border-slate-300 bg-slate-100 px-2 py-1.5">
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={editLocked || creating || !customerId}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-sm h-9"
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
              {(items[pendingDeleteIdx].pallets ?? 0) > 0 && (
                <span>بالێت: <span className="tabular-nums font-semibold">{(items[pendingDeleteIdx].pallets ?? 0).toLocaleString("en-US")}</span></span>
              )}
              {(items[pendingDeleteIdx].bricksPerPallet ?? 0) > 0 && (
                <><span className="text-slate-300">•</span><span>عدد فی بالێت: <span className="tabular-nums font-semibold">{(items[pendingDeleteIdx].bricksPerPallet ?? 0).toLocaleString("en-US")}</span></span></>
              )}
              {items[pendingDeleteIdx].unitPrice > 0 && (
                <><span className="text-slate-300">•</span><span>السعر: <span className="tabular-nums font-semibold">{items[pendingDeleteIdx].unitPrice.toLocaleString("en-US")}</span></span></>
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
