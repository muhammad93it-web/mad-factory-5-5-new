import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { SearchableSelect } from "@/components/searchable-select";
import { AutoTextarea } from "@/components/auto-textarea";
import { PinConfirmModal } from "@/components/pin-confirm-modal";
import { CustomerLedgerSummary } from "@/components/customer-ledger-summary";
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
  Search,
  TriangleAlert,
  Printer,
  Wallet,
  Percent,
} from "lucide-react";

type InvoiceItem = {
  materialId: number | null;
  materialName: string;
  palletCount: number | null;
  bricksPerPallet: number | null;
  totalBricks: number | null;
  unit: string;
  unitPrice: number;
  itemDate: string;
};

const today = () => new Date().toISOString().split("T")[0];

const emptyItem = (): InvoiceItem => ({
  materialId: null,
  materialName: "",
  palletCount: null,
  bricksPerPallet: null,
  totalBricks: null,
  unit: "",
  unitPrice: 0,
  itemDate: today(),
});

// Matches the cyan label / white field cell look from the image.
function FieldRow({
  label, children, labelWidth = "w-28", className, alignTop,
}: {
  label: string;
  children: React.ReactNode;
  labelWidth?: string;
  className?: string;
  alignTop?: boolean;
}) {
  return (
    <div className={`flex items-stretch border border-slate-300 ${className ?? ""}`}>
      <div className={`${labelWidth} bg-cyan-100 text-slate-800 text-[13px] font-semibold flex ${alignTop ? "items-start pt-2" : "items-center"} justify-center px-2 border-l border-slate-300 shrink-0`}>
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
      className={`w-full h-full px-2 py-1.5 bg-transparent border-0 outline-none text-sm ${props.className ?? ""}`}
    />
  );
}

// Stat row used in the totals panel on the left.
function StatRow({ label, value, accent }: { label: string; value: string | number; accent?: "muted" | "warn" | "ok" }) {
  const valueColor =
    accent === "warn"
      ? "text-red-700"
      : accent === "ok"
        ? "text-emerald-700"
        : "text-slate-900";
  return (
    <div className="flex items-stretch border border-slate-300">
      <div className="flex-1 bg-cyan-100 text-slate-800 text-[13px] font-semibold flex items-center px-3">{label}</div>
      <div className={`w-32 bg-white px-3 py-2 text-left tabular-nums font-bold ${valueColor}`} dir="ltr">
        {value}
      </div>
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
  const [customerSearch, setCustomerSearch] = useState(""); // smart search: by name / code / invoice#
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [driver, setDriver] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [guarantorName, setGuarantorName] = useState("");
  const [notes, setNotes] = useState("");
  const [searchPrev, setSearchPrev] = useState("");

  // Totals panel
  const [discount, setDiscount] = useState(0); // direct amount discount
  const [discountPercent, setDiscountPercent] = useState(0); // percentage discount on subtotal
  const [paidAmount, setPaidAmount] = useState(0);
  const [previousDebt, setPreviousDebt] = useState(0);

  // Items — only ONE row at a time; another row can only be added once the current one is filled.
  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()]);

  // Pretty delete confirmation for material rows
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);

  const { data: customers } = useListCustomers({}, { query: { queryKey: getListCustomersQueryKey() } });
  // Sales screen — only show items configured as sellable (sell or both)
  const { data: materials } = useListMaterials({ type: "sell" }, { query: { queryKey: ["materials", "sell"] } });
  const { data: allInvoices } = useListSalesInvoices({}, { query: { queryKey: getListSalesInvoicesQueryKey({}) } });

  // Auto-fill customer fields when customer changes.
  useEffect(() => {
    if (!customerId) return;
    const c = customers?.find((c: { id: number }) => String(c.id) === customerId);
    if (c) {
      setCustomerMobile(c.phone ?? "");
      setCustomerAddress(c.address ?? "");
    }
  }, [customerId, customers]);

  const customerInvoices = useMemo(
    () => (allInvoices ?? []).filter((i: { customerId: number }) => String(i.customerId) === customerId),
    [allInvoices, customerId],
  );

  // After-save destination: "list" → /sales (default), "print" → /sales/{id}?print=1
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

  // Next invoice number = current count + 1 (preview only, server still issues final number).
  const nextInvoiceNo = useMemo(
    () => String((allInvoices?.length ?? 0) + 1).padStart(2, "0"),
    [allInvoices],
  );

  const customerCode = customerId ? customerId.padStart(3, "0") : "";

  // Editable customer-code field — typing a numeric code looks up the matching
  // customer and selects them. Stays in sync with the dropdown selection.
  const [customerCodeInput, setCustomerCodeInput] = useState<string>("");
  useEffect(() => {
    setCustomerCodeInput(customerCode);
  }, [customerCode]);
  const handleCustomerCodeChange = (raw: string) => {
    // Only digits allowed; numeral normalizer already converts ٠-٩ → 0-9.
    const digits = raw.replace(/\D/g, "");
    setCustomerCodeInput(digits);
    if (!digits) {
      setCustomerId("");
      return;
    }
    const n = Number(digits);
    const match = (customers ?? []).find((c: { id: number }) => c.id === n);
    if (match) setCustomerId(String(match.id));
  };
  const handleCustomerCodeBlur = () => {
    // On blur, normalize display to the 3-digit padded form when a customer is selected.
    if (customerId) setCustomerCodeInput(customerCode);
  };

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number | null) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        let next: InvoiceItem;
        if (field === "materialId") {
          if (value === null) {
            // User picked "--- ناوی دیکە ---" → clear material binding so they can type a custom name
            next = { ...item, materialId: null, materialName: "" };
          } else {
            const mat = materials?.find((m: { id: number }) => m.id === Number(value));
            next = {
              ...item,
              materialId: mat?.id ?? null,
              materialName: mat?.name ?? item.materialName,
              unitPrice: mat ? Number(mat.salePrice ?? mat.purchasePrice) : item.unitPrice,
              bricksPerPallet: mat?.bricksPerPallet ?? item.bricksPerPallet,
              unit: mat?.unit ?? item.unit ?? "بالێت",
            };
          }
        } else {
          next = { ...item, [field]: value };
        }
        // Auto compute total bricks from pallet count × bricks/pallet — clears to null if either side is missing
        if (next.palletCount != null && next.bricksPerPallet != null) {
          next.totalBricks = Number((next.palletCount * next.bricksPerPallet).toFixed(2));
        } else {
          next.totalBricks = null;
        }
        return next;
      }),
    );
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);
  const removeRow = (idx: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const lineTotal = (it: InvoiceItem) => {
    const qty = it.totalBricks ?? 0;
    return qty * it.unitPrice;
  };

  const subtotal = items.reduce((s, i) => s + lineTotal(i), 0);
  // Two discounts: direct amount + percentage of subtotal. Both subtract from subtotal.
  const percentDiscountAmount = Math.round(subtotal * (discountPercent / 100));
  const effectiveDiscount = discount + percentDiscountAmount;
  const totalAfterDiscount = subtotal - effectiveDiscount;
  const grandTotal = totalAfterDiscount + previousDebt;
  const remaining = grandTotal - paidAmount;
  const totalPallets = items.reduce((s, i) => s + (i.palletCount ?? 0), 0);
  const totalBricks = items.reduce((s, i) => s + (i.totalBricks ?? 0), 0);

  // Customer search filter — matches by name, customer code (id padded), or invoice #
  // Also: if the search query exactly matches an invoice number, auto-pick its customer.
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers ?? [];
    const list = customers ?? [];
    const invoicesArr = allInvoices ?? [];
    return list.filter((c: { id: number; name: string }) => {
      const codePadded = String(c.id).padStart(3, "0");
      if (
        c.name.toLowerCase().includes(q) ||
        codePadded.includes(q) ||
        String(c.id) === q
      ) return true;
      // Also match by any of this customer's invoice numbers
      return invoicesArr.some((inv: { invoiceNumber?: string; customerId: number }) =>
        inv.customerId === c.id && (inv.invoiceNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [customers, customerSearch, allInvoices]);

  // The "Add row" button is enabled only if last row is sufficiently filled.
  const lastItem = items[items.length - 1];
  const canAddRow =
    !!lastItem &&
    !!lastItem.materialName &&
    (lastItem.totalBricks ?? 0) > 0 &&
    lastItem.unitPrice > 0;

  const resetForm = () => {
    setCustomerId("");
    setCustomerSearch("");
    setCustomerMobile("");
    setCustomerAddress("");
    setInvoiceDate(today());
    setDriver("");
    setDriverMobile("");
    setGuarantorName("");
    setNotes("");
    setSearchPrev("");
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
      if (currentId == null) {
        target = sorted[sorted.length - 1];
      } else {
        const idx = sorted.findIndex((x: { id: number }) => x.id === currentId);
        target = idx > 0 ? sorted[idx - 1] : sorted[0];
      }
    } else if (direction === "next") {
      if (currentId == null) {
        target = sorted[0];
      } else {
        const idx = sorted.findIndex((x: { id: number }) => x.id === currentId);
        target = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : sorted[sorted.length - 1];
      }
    }
    if (target) navigate(`/sales/${target.id}`);
  };

  const handleSubmit = () => {
    if (!customerId) return;
    const validItems = items.filter((i) => i.materialName && (i.totalBricks ?? 0) > 0);
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
          quantity: i.totalBricks ?? 0,
          unitPrice: i.unitPrice,
          palletCount: i.palletCount ?? undefined,
          bricksPerPallet: i.bricksPerPallet ?? undefined,
          totalBricks: i.totalBricks ?? undefined,
          notes: undefined,
        })),
      },
    });
  };

  return (
    <div dir="rtl" className="min-h-[calc(100vh-4rem)] bg-slate-100 -m-4 md:-m-6 p-2 md:p-3">
      <div className="bg-white border border-slate-400 shadow-sm rounded-sm overflow-hidden flex flex-col">
        {/* Title bar */}
        <div className="bg-emerald-300 border-b border-slate-400 py-2 text-center font-extrabold text-2xl text-slate-800 tracking-wide">
          فرۆشتن
        </div>

        {/* Header form fields — restructured per spec:
            row 1: narrow ژ.وصل + narrow کۆد/کڕیار + بەروار + مۆبایل
            row 2: ناوی کەفیل + ناونیشان + ناوی شۆفێر + ز.م.شۆفێر
            row 3: اسم/کڕیار (autocomplete) + گەڕان بەپێی ژ.وەسڵ
            row 4: full-width auto-grow textarea تێبینی */}
        <div className="p-3 space-y-2">
          {/* Row 1 — invoice meta */}
          <div className="grid grid-cols-12 gap-2">
            <FieldRow label="ژ.وصل" labelWidth="w-20" className="col-span-6 sm:col-span-3 lg:col-span-2">
              <PlainInput value={nextInvoiceNo} readOnly className="font-mono font-bold text-slate-700 text-left" dir="ltr" />
            </FieldRow>
            <FieldRow label="کۆد/کڕیار" labelWidth="w-24" className="col-span-6 sm:col-span-3 lg:col-span-2">
              <PlainInput
                value={customerCodeInput}
                readOnly={editLocked}
                onChange={(e) => handleCustomerCodeChange(e.target.value)}
                onBlur={handleCustomerCodeBlur}
                inputMode="numeric"
                className="font-mono font-bold text-slate-700 text-left"
                dir="ltr"
                placeholder="کۆد..."
                title="کۆدی کڕیار بنووسە بۆ گەڕان"
              />
            </FieldRow>
            <FieldRow label="بەروار" className="col-span-6 sm:col-span-3 lg:col-span-4">
              <PlainInput type="date" value={invoiceDate} readOnly={editLocked} onChange={(e) => setInvoiceDate(e.target.value)} dir="ltr" />
            </FieldRow>
            <FieldRow label="مۆبایل" className="col-span-6 sm:col-span-3 lg:col-span-4">
              <PlainInput value={customerMobile} readOnly={editLocked} onChange={(e) => setCustomerMobile(e.target.value)} dir="ltr" placeholder="07XX..." />
            </FieldRow>
          </div>

          {/* Row 2 — guarantor / address / driver */}
          <div className="grid grid-cols-12 gap-2">
            <FieldRow label="ناوی کەفیل" className="col-span-12 sm:col-span-6 lg:col-span-3">
              <PlainInput value={guarantorName} readOnly={editLocked} onChange={(e) => setGuarantorName(e.target.value)} placeholder="ناوی کەفیل..." />
            </FieldRow>
            <FieldRow label="ناونیشان" className="col-span-12 sm:col-span-6 lg:col-span-3">
              <PlainInput value={customerAddress} readOnly={editLocked} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="ناونیشان..." />
            </FieldRow>
            <FieldRow label="ناوی شۆفێر" className="col-span-12 sm:col-span-6 lg:col-span-3">
              <PlainInput value={driver} readOnly={editLocked} onChange={(e) => setDriver(e.target.value)} placeholder="ناوی شۆفێر..." />
            </FieldRow>
            <FieldRow label="ز.م.شۆفێر" className="col-span-12 sm:col-span-6 lg:col-span-3">
              <PlainInput value={driverMobile} readOnly={editLocked} onChange={(e) => setDriverMobile(e.target.value)} dir="ltr" placeholder="07XX..." />
            </FieldRow>
          </div>

          {/* Row 3 — searchable customer + previous invoice quick-pick */}
          <div className="grid grid-cols-12 gap-2">
            <FieldRow label="اسم/کڕیار" className="col-span-12 lg:col-span-7">
              <SearchableSelect
                value={customerId}
                onChange={setCustomerId}
                disabled={editLocked}
                placeholder="گەڕان بە ناو / کۆد / ژ.وەسڵ..."
                buttonClassName="text-sm"
                options={(filteredCustomers as Array<{ id: number; name: string }>).map((c) => {
                  const code = String(c.id).padStart(3, "0");
                  const invs = (allInvoices ?? []).filter((i: { customerId: number; invoiceNumber?: string }) => i.customerId === c.id).map((i: { invoiceNumber?: string }) => i.invoiceNumber ?? "").join(" ");
                  return {
                    value: String(c.id),
                    label: c.name,
                    sub: code,
                    haystack: `${c.name} ${code} ${invs}`,
                  };
                })}
              />
            </FieldRow>
            <FieldRow label="گەڕان بەپێی ژ.وەسڵ" labelWidth="w-32" className="col-span-12 lg:col-span-5">
              <div className="flex h-full">
                <select
                  value={searchPrev}
                  onChange={(e) => setSearchPrev(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-transparent border-0 outline-none text-sm"
                >
                  <option value="">— پسووڵە —</option>
                  {customerInvoices.map((inv: { id: number; invoiceNumber: string; invoiceDate: string }) => (
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

          {/* Row 4 — notes (full-width auto-grow textarea) */}
          <div className="grid grid-cols-12 gap-2">
            <FieldRow label="تێبینی" labelWidth="w-20" className="col-span-12" alignTop>
              <AutoTextarea
                value={notes}
                readOnly={editLocked}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تێبینی..."
                minRows={2}
                maxRows={8}
                className="read-only:cursor-not-allowed"
              />
            </FieldRow>
          </div>
        </div>

        {/* Body: items table + totals */}
        <div className="px-3 pb-3 grid grid-cols-12 gap-3">
          {/* Items table — col-span lg 9 (main, on right side in RTL) */}
          <div className="col-span-12 lg:col-span-9 order-2 lg:order-1">
            <div className="border border-slate-400 bg-white overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-amber-50 text-slate-800 text-[12px]">
                    <th className="border border-slate-400 px-2 py-2 font-bold w-[24%]">ناوی/اسم المواد</th>
                    <th className="border border-slate-400 px-2 py-2 font-bold w-[9%]">عدد بالیت</th>
                    <th className="border border-slate-400 px-2 py-2 font-bold w-[9%]">عدد فی بالیت</th>
                    <th className="border border-slate-400 px-2 py-2 font-bold w-[12%]">جمع طابوق</th>
                    <th className="border border-slate-400 px-2 py-2 font-bold w-[12%]">السعر</th>
                    <th className="border border-slate-400 px-2 py-2 font-bold w-[16%]">جمع کل</th>
                    <th className="border border-slate-400 px-2 py-2 font-bold w-[14%]">تاریخ الحمل</th>
                    <th className="border border-slate-400 px-1 py-2 font-bold w-9"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 align-middle">
                      {/* Material name */}
                      <td className="border border-slate-400 p-0">
                        <select
                          value={item.materialId ?? ""}
                          disabled={editLocked}
                          onChange={(e) => {
                            if (e.target.value) updateItem(idx, "materialId", e.target.value);
                            else updateItem(idx, "materialId", null);
                          }}
                          className="w-full px-2 py-1 bg-transparent border-0 outline-none text-sm font-medium disabled:cursor-not-allowed"
                        >
                          <option value="">— هەڵبژێرە —</option>
                          {materials?.map((m: { id: number; name: string }) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Pallet count */}
                      <td className="border border-slate-400 p-0">
                        <input
                          type="number"
                          step="0.5"
                          value={item.palletCount ?? ""}
                          readOnly={editLocked}
                          onChange={(e) =>
                            updateItem(idx, "palletCount", e.target.value ? Number(e.target.value) : null)
                          }
                          className="w-full px-2 py-1 bg-transparent border-0 outline-none text-center tabular-nums text-blue-700 font-semibold read-only:cursor-not-allowed"
                          placeholder="0"
                        />
                      </td>

                      {/* Bricks per pallet (input — how many bricks per single pallet) */}
                      <td className="border border-slate-400 p-0">
                        <input
                          type="number"
                          value={item.bricksPerPallet ?? ""}
                          readOnly={editLocked}
                          onChange={(e) =>
                            updateItem(idx, "bricksPerPallet", e.target.value ? Number(e.target.value) : null)
                          }
                          className="w-full px-2 py-1 bg-transparent border-0 outline-none text-center tabular-nums text-blue-700 font-semibold read-only:cursor-not-allowed"
                          placeholder="0"
                        />
                      </td>

                      {/* Total bricks (computed read-only display = palletCount × bricksPerPallet) */}
                      <td className="border border-slate-400 px-2 py-1 text-center tabular-nums font-bold text-slate-900 bg-slate-50" dir="ltr">
                        {item.totalBricks != null ? item.totalBricks.toLocaleString("en-US") : "—"}
                      </td>

                      {/* Unit price */}
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

                      {/* Line total */}
                      <td className="border border-slate-400 px-2 py-1 text-right tabular-nums font-bold text-slate-900" dir="ltr">
                        {lineTotal(item) ? lineTotal(item).toLocaleString("en-US") : "0"}
                      </td>

                      {/* Per-row date */}
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

                      {/* Remove */}
                      <td className="border border-slate-400 p-0 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            // Empty rows can be removed without confirmation
                            const hasData =
                              !!item.materialName ||
                              !!item.materialId ||
                              (item.totalBricks ?? 0) > 0 ||
                              (item.palletCount ?? 0) > 0 ||
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
          </div>

          {/* Totals panel — appears on the LEFT (visually) in RTL when placed last */}
          <div className="col-span-12 lg:col-span-3 order-1 lg:order-2 space-y-1.5">
            <StatRow label="کۆی گشتی/جمع کل" value={formatMoney(subtotal)} />
            <div className="flex items-stretch border border-slate-300">
              <div className="flex-1 bg-cyan-100 text-slate-800 text-[13px] font-semibold flex items-center px-3">
                قەرزی کۆن/الدین
              </div>
              <input
                type="number"
                value={previousDebt || ""}
                readOnly={editLocked}
                onChange={(e) => setPreviousDebt(Number(e.target.value))}
                className="w-32 px-3 py-2 bg-white text-left tabular-nums outline-none text-sm read-only:cursor-not-allowed"
                placeholder="0"
                dir="ltr"
              />
            </div>
            <div className="flex items-stretch border border-slate-300">
              <div className="flex-1 bg-cyan-100 text-slate-800 text-[13px] font-semibold flex items-center px-3">
                پارەدان/الواصلات
              </div>
              <input
                type="number"
                value={paidAmount || ""}
                readOnly={editLocked}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
                className="w-32 px-3 py-2 bg-white text-left tabular-nums outline-none text-sm text-emerald-700 font-semibold read-only:cursor-not-allowed"
                placeholder="0"
                dir="ltr"
              />
            </div>
            {/* Quick-fill payment buttons */}
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                disabled={editLocked}
                onClick={() => {
                  const fullDue = subtotal + previousDebt;
                  setPaidAmount(Math.max(0, Math.round(fullDue)));
                }}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="کۆی فرۆشتن + قەرزی پێشوو، بێ داشکاندن"
              >
                <Wallet className="h-3 w-3" />
                = کۆی گشتی
              </button>
              <button
                type="button"
                disabled={editLocked}
                onClick={() => setPaidAmount(Math.max(0, Math.round(grandTotal)))}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="کۆی گشتی پاش لابردنی داشکاندن"
              >
                <Percent className="h-3 w-3" />
                = دوای داشکاندن
              </button>
            </div>
            <div className="flex items-stretch border border-slate-300">
              <div className="flex-1 bg-cyan-100 text-slate-800 text-[13px] font-semibold flex items-center px-3">
                داشکاندن
              </div>
              <input
                type="number"
                value={discount || ""}
                readOnly={editLocked}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-32 px-3 py-2 bg-white text-left tabular-nums outline-none text-sm read-only:cursor-not-allowed"
                placeholder="0"
                dir="ltr"
              />
            </div>
            <div className="flex items-stretch border border-slate-300">
              <div className="flex-1 bg-amber-100 text-slate-800 text-[13px] font-semibold flex items-center px-3">
                داشکاندنی ڕێژەیی
                <span className="text-[10px] text-slate-500 mr-1">(%)</span>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={discountPercent || ""}
                readOnly={editLocked}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  // clamp 0..100
                  setDiscountPercent(Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0);
                }}
                className="w-32 px-3 py-2 bg-white text-left tabular-nums outline-none text-sm read-only:cursor-not-allowed text-amber-700 font-semibold"
                placeholder="0"
                dir="ltr"
                title="بۆ نموونە: ٥ واتە ٥٪ لە کۆی گشتی"
              />
            </div>
            {discountPercent > 0 && (
              <div className="text-[11px] text-slate-500 text-left px-1" dir="ltr">
                ‎−{percentDiscountAmount.toLocaleString("en-US")} ({discountPercent}%)
              </div>
            )}
            <StatRow label="قەرزی ماوە" value={formatMoney(remaining)} accent={remaining > 0 ? "warn" : "ok"} />
            <div className="h-1" />
            <StatRow label="کۆی بالێت" value={totalPallets.toLocaleString()} />
            <StatRow label="کۆی خشت" value={totalBricks.toLocaleString()} />
          </div>
        </div>

        {/* Dynamic Customer Ledger Summary — fetches the customer's full sales/payment
            history and combines it with this invoice's live totals. */}
        <CustomerLedgerSummary
          customerId={customerId ? Number(customerId) : null}
          currentInvoiceTotal={totalAfterDiscount}
          currentPayment={paidAmount}
        />

        {/* Bottom action bar — matches the colored button strip from the image */}
        <div className="border-t border-slate-400 bg-slate-50 px-3 py-2 flex flex-wrap items-center gap-2 justify-center">
          {/* Lock / unlock toggle — primary "کردنەوە" button. Page is read-only until pressed. */}
          <Button
            type="button"
            onClick={() => setEditLocked((v) => !v)}
            className={`${
              editLocked
                ? "bg-pink-400 hover:bg-pink-500 text-red-900 border border-red-700"
                : "bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-800"
            } font-bold gap-1 shadow-sm`}
            title={editLocked ? "کردنەوە بۆ دەستکاری" : "داخستنی دەستکاری"}
          >
            {editLocked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            {editLocked ? "کردنەوە" : "داخستنی دەستکاری"}
          </Button>

          <Button
            type="button"
            onClick={goToCustomerStatement}
            disabled={!customerId}
            className="bg-orange-400 hover:bg-orange-500 text-white font-bold gap-1 shadow-sm"
          >
            <FileText className="h-4 w-4" />
            کەشف حسابی کڕیار
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/sales")}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold gap-1 border-slate-400"
          >
            <X className="h-4 w-4" />
            داخستن
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={openPrevInvoice}
            disabled={!searchPrev}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold gap-1 border-slate-400"
          >
            <FolderOpen className="h-4 w-4" />
            بینینی پسووڵە
          </Button>

          <Button
            type="button"
            onClick={() => {
              setPostSaveAction("print");
              handleSubmit();
            }}
            disabled={editLocked || creating || !customerId}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1 shadow-sm"
            title="پاشەکەوت + کردنەوە بە شێوەی وەسڵی A4 بۆ چاپ"
          >
            <Printer className="h-4 w-4" />
            وەسڵی گەورە A4
          </Button>

          <div className="flex items-center gap-1 border-x border-slate-400 px-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigateInvoice("first")}
              className="h-8 w-8 border-slate-400"
              title="یەکەم"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigateInvoice("prev")}
              className="h-8 w-8 border-slate-400"
              title="پێشوو"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigateInvoice("next")}
              className="h-8 w-8 border-slate-400"
              title="دواتر"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigateInvoice("last")}
              className="h-8 w-8 border-slate-400"
              title="کۆتایی"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          </div>

          <Button
            type="button"
            onClick={resetForm}
            disabled={editLocked}
            className="bg-emerald-400 hover:bg-emerald-500 text-white font-bold gap-1 shadow-sm"
          >
            <RotateCw className="h-4 w-4" />
            ڕیفرێش
          </Button>

          <Button
            type="button"
            onClick={addRow}
            disabled={editLocked || !canAddRow}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-1 shadow-sm"
            title={
              editLocked
                ? "بۆ زیادکردن، سەرەتا کردنەوە دابگرە"
                : !canAddRow
                ? "سەرەتا ڕیزی پێشوو پڕبکەرەوە"
                : "زیادکردنی ڕیز"
            }
          >
            <Plus className="h-4 w-4" />
            زیاد کردن
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={editLocked || creating || !customerId}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1 shadow-sm min-w-[110px]"
            title={editLocked ? "بۆ پاشەکەوت، کردنەوە دابگرە" : "پاشەکەوت"}
          >
            <Save className="h-4 w-4" />
            {creating ? "تۆمارکردن..." : "پاشەکەوت"}
          </Button>
        </div>
      </div>

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
              {items[pendingDeleteIdx].totalBricks != null && (
                <span>خشت: <span className="tabular-nums font-semibold">{(items[pendingDeleteIdx].totalBricks ?? 0).toLocaleString("en-US")}</span></span>
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
