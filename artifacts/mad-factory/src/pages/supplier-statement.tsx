import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Pencil, Printer, Search, ArrowLeft, FileText, FileBarChart } from "lucide-react";
import {
  useListSuppliers,
  useListPurchaseInvoices,
  useListSupplierPayments,
  getListSuppliersQueryKey,
  getListPurchaseInvoicesQueryKey,
  getListSupplierPaymentsQueryKey,
} from "@workspace/api-client-react";
import { SearchableSelect, type Option } from "@/components/searchable-select";
import { PrintStyles } from "@/components/print-styles";
import { formatDate } from "@/lib/format";

type Mode = "search" | "grid-all" | "grid-range" | "print-all" | "print-range";

type Row = {
  date: string;
  receiptNo: string;
  supplierCode: number;
  name: string;
  mobile: string;
  type: "کڕین" | "پارەدان";
  invoiceAmount: number; // IQD
  paymentAmount: number; // IQD
  discount: number; // IQD
  oldBalance: number;
  editHref: string | null;
};

const BLUE = "#2E75B6";
const BLUE_LIGHT = "#D9E5F1";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SupplierStatementPage() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("search");
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [codeInput, setCodeInput] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>(todayIso());
  const [toDate, setToDate] = useState<string>(todayIso());

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: suppliers } = useListSuppliers(
    {},
    { query: { queryKey: getListSuppliersQueryKey({}) } },
  );

  const supplier = useMemo(
    () => (suppliers ?? []).find((s) => s.id === supplierId) ?? null,
    [suppliers, supplierId],
  );
  const supplierEnabled = !!supplier;
  const codeNotFound =
    supplierId !== null && (suppliers?.length ?? 0) > 0 && !supplier;

  const { data: purchaseInvoices } = useListPurchaseInvoices(
    { supplierId: supplierId ?? 0 },
    {
      query: {
        enabled: supplierEnabled,
        queryKey: getListPurchaseInvoicesQueryKey({ supplierId: supplierId ?? 0 }),
        staleTime: 0,
      },
    },
  );
  const { data: payments } = useListSupplierPayments(
    { supplierId: supplierId ?? 0 },
    {
      query: {
        enabled: supplierEnabled,
        queryKey: getListSupplierPaymentsQueryKey({ supplierId: supplierId ?? 0 }),
        staleTime: 0,
      },
    },
  );

  // ── Combobox options ──────────────────────────────────────────────────────
  const options = useMemo<Option[]>(
    () =>
      (suppliers ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
        sub: String(s.id),
        haystack: `${s.name} ${s.id} ${s.phone ?? ""}`,
      })),
    [suppliers],
  );

  useEffect(() => {
    if (supplierId !== null) setCodeInput(String(supplierId));
  }, [supplierId]);

  const openingBalance = Number(supplier?.openingBalance ?? 0);

  // ── Build rows (mirrors statement-of-account-modal supplier branch) ───────
  const allRows = useMemo<Row[]>(() => {
    if (!supplier) return [];
    const out: Row[] = [];
    (purchaseInvoices ?? []).forEach((inv) => {
      const fx = inv.currency === "USD" ? Number(inv.exchangeRateValue ?? 1) : 1;
      const discountIqd = Number(inv.discount ?? 0) * fx;
      const sub = Number(inv.subtotalIqd ?? Number(inv.subtotal ?? 0) * fx);
      out.push({
        date: inv.invoiceDate,
        receiptNo: inv.invoiceNumber,
        supplierCode: supplier.id,
        name: inv.supplierName ?? supplier.name,
        mobile: inv.supplierMobile ?? supplier.phone ?? "",
        type: "کڕین",
        invoiceAmount: sub,
        paymentAmount: Number(inv.paidAmountIqd ?? inv.paidAmount ?? 0),
        discount: discountIqd,
        oldBalance: 0,
        editHref: `/purchases/${inv.id}`,
      });
    });
    (payments ?? []).forEach((p) => {
      out.push({
        date: p.paymentDate,
        receiptNo: `پ-${p.id}`,
        supplierCode: supplier.id,
        name: p.supplierName || supplier.name,
        mobile: supplier.phone ?? "",
        type: "پارەدان",
        invoiceAmount: 0,
        paymentAmount: Number(p.amountIqd ?? p.amount ?? 0),
        discount: 0,
        oldBalance: 0,
        editHref: `/supplier-payments`,
      });
    });
    out.sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.receiptNo.localeCompare(b.receiptNo),
    );
    let running = openingBalance;
    out.forEach((r) => {
      r.oldBalance = running;
      running += r.invoiceAmount - r.discount - r.paymentAmount;
    });
    return out;
  }, [supplier, purchaseInvoices, payments, openingBalance]);

  const isRangeMode = mode === "grid-range" || mode === "print-range";
  const previousBalance = useMemo(() => {
    if (!isRangeMode) return openingBalance;
    let prev = openingBalance;
    for (const r of allRows) {
      if (r.date < fromDate) prev += r.invoiceAmount - r.discount - r.paymentAmount;
      else break;
    }
    return prev;
  }, [allRows, fromDate, openingBalance, isRangeMode]);

  const visibleRows = useMemo(() => {
    if (!isRangeMode) return allRows;
    const out = allRows.filter((r) => r.date >= fromDate && r.date <= toDate);
    let running = previousBalance;
    out.forEach((r) => {
      r.oldBalance = running;
      running += r.invoiceAmount - r.discount - r.paymentAmount;
    });
    return out;
  }, [allRows, fromDate, toDate, isRangeMode, previousBalance]);

  const totals = useMemo(() => {
    const totalPurchases = visibleRows.reduce((s, r) => s + r.invoiceAmount, 0);
    const totalPaid = visibleRows.reduce((s, r) => s + r.paymentAmount, 0);
    const totalDiscount = visibleRows.reduce((s, r) => s + r.discount, 0);
    const finalBalance = previousBalance + totalPurchases - totalPaid - totalDiscount;
    return { totalPurchases, totalPaid, totalDiscount, finalBalance };
  }, [visibleRows, previousBalance]);

  useEffect(() => {
    if (mode === "print-all" || mode === "print-range") {
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [mode]);

  const supplierName = supplier?.name ?? "";
  const supplierMobile = supplier?.phone ?? "";

  // ─────────────────────────────────────────────────────────────────────────
  // SEARCH FORM
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === "search") {
    return (
      <div className="flex items-start justify-center pt-6">
        <div
          className="w-[760px] max-w-full bg-white border border-slate-300 shadow-lg rounded-md overflow-hidden"
          dir="rtl"
        >
          {/* Blue header */}
          <div
            className="text-center py-4 text-2xl font-extrabold text-white"
            style={{ background: BLUE }}
          >
            کەشف حسابی فرۆشیار
          </div>

          {/* Form area */}
          <div className="px-12 py-8 space-y-4 bg-white">
            {/* Supplier Code */}
            <div className="grid grid-cols-[140px_1fr] items-stretch gap-0">
              <label
                className="px-3 py-2 text-right font-bold text-slate-700 border border-slate-400 border-l-0 rounded-r"
                style={{ background: BLUE_LIGHT }}
              >
                کۆدی فرۆشیار
              </label>
              <input
                type="number"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value);
                  const id = Number(e.target.value);
                  if (Number.isFinite(id) && id > 0) setSupplierId(id);
                  else setSupplierId(null);
                }}
                className="border border-slate-400 px-3 py-2 text-right tabular-nums outline-none focus:ring-2 focus:ring-blue-400 rounded-l"
                placeholder="0"
              />
            </div>

            {/* Supplier Name */}
            <div className="grid grid-cols-[140px_1fr] items-stretch gap-0">
              <label
                className="px-3 py-2 text-right font-bold text-slate-700 border border-slate-400 border-l-0 rounded-r"
                style={{ background: "#E8DFF2" }}
              >
                ناوی فرۆشیار
              </label>
              <div className="border border-slate-400 rounded-l">
                <SearchableSelect
                  value={supplierId !== null ? String(supplierId) : ""}
                  onChange={(v) => setSupplierId(v ? Number(v) : null)}
                  options={options}
                  placeholder="ناوی فرۆشیار هەڵبژێرە یان بنووسە..."
                  buttonClassName="px-3 py-2 text-right"
                />
              </div>
            </div>

            {/* From / To dates + buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <div className="grid grid-cols-[100px_1fr] items-stretch gap-0">
                <label className="px-3 py-2 text-right font-bold text-slate-700 border border-slate-400 border-l-0 bg-slate-100 rounded-r">
                  لە بەرواری
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border border-slate-400 px-3 py-2 text-right tabular-nums outline-none focus:ring-2 focus:ring-blue-400 rounded-l"
                />
              </div>
              <button
                type="button"
                disabled={!supplierEnabled}
                onClick={() => setMode("grid-range")}
                className="border-2 font-extrabold rounded px-4 py-2 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ borderColor: BLUE, color: BLUE }}
              >
                فۆڕم بە پێی بەروار
              </button>

              <div className="grid grid-cols-[100px_1fr] items-stretch gap-0">
                <label className="px-3 py-2 text-right font-bold text-slate-700 border border-slate-400 border-l-0 bg-slate-100 rounded-r">
                  بۆ بەرواری
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border border-slate-400 px-3 py-2 text-right tabular-nums outline-none focus:ring-2 focus:ring-blue-400 rounded-l"
                />
              </div>
              <button
                type="button"
                disabled={!supplierEnabled}
                onClick={() => setMode("grid-all")}
                className="border-2 font-extrabold rounded px-4 py-2 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ borderColor: BLUE, color: BLUE }}
              >
                فۆڕم گشتی
              </button>

              <button
                type="button"
                disabled={!supplierEnabled}
                onClick={() => setMode("print-range")}
                className="border-2 border-rose-600 text-rose-600 font-extrabold rounded px-4 py-2 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <FileBarChart className="h-4 w-4" />
                ڕاپۆرت بە پێی بەروار
              </button>
              <button
                type="button"
                disabled={!supplierEnabled}
                onClick={() => setMode("print-all")}
                className="border-2 border-rose-600 text-rose-600 font-extrabold rounded px-4 py-2 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                ڕاپۆرتی گشتی
              </button>
            </div>

            {codeNotFound && (
              <div className="text-center text-xs text-rose-600 font-bold pt-2">
                ⚠ فرۆشیار بەم کۆدە نەدۆزرایەوە — تکایە کۆدێکی دروست بنووسە یان ناوەکە لە لیستەکە هەڵبژێرە
              </div>
            )}
            {!supplierEnabled && !codeNotFound && (
              <div className="text-center text-xs text-slate-500 pt-2">
                <Search className="h-3.5 w-3.5 inline-block mb-0.5" /> یەکێک لە فرۆشیارەکان هەڵبژێرە بۆ ئەوەی دوگمەکان چالاک بکرێن
              </div>
            )}
          </div>

          {/* Blue footer */}
          <div className="h-8" style={{ background: BLUE }} />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRINT VIEWS
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === "print-all" || mode === "print-range") {
    const isRange = mode === "print-range";
    return (
      <div dir="rtl" className="bg-white">
        <PrintStyles />
        <div className="print:hidden flex items-center justify-between mb-3 px-2">
          <button
            onClick={() => setMode("search")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" /> گەڕانەوە
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-white text-sm font-bold"
            style={{ background: BLUE }}
          >
            <Printer className="h-4 w-4" /> چاپکردن
          </button>
        </div>

        <div className="print-area mx-auto w-[21cm] max-w-full bg-white p-6 border border-slate-200">
          <div
            className="flex items-center justify-between mb-4 pb-3 border-b-2"
            style={{ borderColor: BLUE }}
          >
            <div className="text-right">
              <div className="text-lg font-extrabold" style={{ color: BLUE }}>
                کشف حساب فرۆشیار :
              </div>
              <div className="text-base font-bold text-slate-800 mt-0.5">{supplierName}</div>
              {supplierMobile && (
                <div className="text-xs text-slate-500 mt-0.5" dir="ltr">{supplierMobile}</div>
              )}
            </div>
            {isRange && (
              <div className="text-left text-sm text-slate-700 space-y-0.5">
                <div>
                  <span className="font-bold" style={{ color: BLUE }}>من تاریخ :</span>{" "}
                  <span className="tabular-nums" dir="ltr">{formatDate(fromDate)}</span>
                </div>
                <div>
                  <span className="font-bold" style={{ color: BLUE }}>الی تاریخ :</span>{" "}
                  <span className="tabular-nums" dir="ltr">{formatDate(toDate)}</span>
                </div>
              </div>
            )}
          </div>

          <table className="w-full border-collapse text-[11px]" style={{ direction: "rtl" }}>
            <thead>
              <tr style={{ background: BLUE_LIGHT }}>
                <th className="border border-slate-400 px-2 py-1.5 font-bold w-[5%]">ژ</th>
                <th className="border border-slate-400 px-2 py-1.5 font-bold w-[8%]">رقم الوصل</th>
                <th className="border border-slate-400 px-2 py-1.5 font-bold w-[14%]">نوع الوصل / فاتور</th>
                <th className="border border-slate-400 px-2 py-1.5 font-bold w-[12%]">تاریخ</th>
                <th className="border border-slate-400 px-2 py-1.5 font-bold w-[15%]">المشتریات / کڕین</th>
                <th className="border border-slate-400 px-2 py-1.5 font-bold w-[15%]">المدفوعات / پارەدان</th>
                <th className="border border-slate-400 px-2 py-1.5 font-bold w-[10%]">داشکاندن</th>
                {isRange ? (
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[14%]">حساب قبلی</th>
                ) : (
                  <th className="border border-slate-400 px-2 py-1.5 font-bold w-[14%]">الدین / قەرزی کۆن</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isRange && (
                <tr style={{ background: "#FFF7E0" }}>
                  <td className="border border-slate-400 px-2 py-1.5 text-center font-bold" colSpan={7}>
                    حسابی پێشوو (Previous Balance)
                  </td>
                  <td className="border border-slate-400 px-2 py-1.5 text-left tabular-nums font-bold text-rose-700" dir="ltr">
                    {previousBalance.toLocaleString("en-US")}
                  </td>
                </tr>
              )}
              {visibleRows.map((r, i) => (
                <tr key={i} className="even:bg-slate-50/50">
                  <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">{i + 1}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums font-semibold">{r.receiptNo}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center">
                    {r.type === "کڕین" ? "المشتریات" : "المدفوعات"}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums" dir="ltr">{r.date}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-left tabular-nums font-semibold" dir="ltr" style={{ color: BLUE }}>
                    {r.invoiceAmount ? r.invoiceAmount.toLocaleString("en-US") : "0"}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-left tabular-nums text-rose-700 font-semibold" dir="ltr">
                    {r.paymentAmount ? r.paymentAmount.toLocaleString("en-US") : "0"}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-left tabular-nums" dir="ltr">
                    {r.discount ? r.discount.toLocaleString("en-US") : "0"}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-left tabular-nums" dir="ltr">
                    {r.oldBalance ? r.oldBalance.toLocaleString("en-US") : "0"}
                  </td>
                </tr>
              ))}
              <tr style={{ background: BLUE, color: "white" }}>
                <td className="border border-slate-400 px-2 py-2 text-center font-extrabold" colSpan={4}>
                  کۆی گشتی
                </td>
                <td className="border border-slate-400 px-2 py-2 text-left tabular-nums font-extrabold" dir="ltr">
                  {totals.totalPurchases.toLocaleString("en-US")}
                </td>
                <td className="border border-slate-400 px-2 py-2 text-left tabular-nums font-extrabold" dir="ltr">
                  {totals.totalPaid.toLocaleString("en-US")}
                </td>
                <td className="border border-slate-400 px-2 py-2 text-left tabular-nums font-extrabold" dir="ltr">
                  {totals.totalDiscount.toLocaleString("en-US")}
                </td>
                <td className="border border-slate-400 px-2 py-2 text-left tabular-nums font-extrabold" dir="ltr">
                  {totals.finalBalance.toLocaleString("en-US")}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6 grid grid-cols-3 gap-4 text-[11px] text-slate-700">
            <div className="border-t border-slate-300 pt-2 text-center">واژووی فرۆشیار</div>
            <div className="border-t border-slate-300 pt-2 text-center">واژووی ژمێریار</div>
            <div className="border-t border-slate-300 pt-2 text-center">واژووی بەڕێوەبەر</div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GRID VIEWS
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="bg-white border border-slate-300 rounded-md overflow-hidden shadow-sm">
      {/* Top action bar (no Access-style window title) */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-end">
        <button
          onClick={() => setMode("search")}
          className="text-blue-600 hover:underline text-xs font-semibold flex items-center gap-1"
        >
          <ArrowLeft className="h-3 w-3 rotate-180" /> گەڕانەوە بۆ گەڕان
        </button>
      </div>

      {/* Blue title bar */}
      <div
        className="px-4 py-2 text-center text-base font-extrabold text-white"
        style={{ background: BLUE }}
      >
        <span className="text-white/90">کەشف حسابی فرۆشیار :</span>{" "}
        <span>{supplierName}</span>
        {isRangeMode && (
          <>
            <span className="mx-3 text-white/70">|</span>
            <span className="text-white/90">لە بەرواری :</span>{" "}
            <span dir="ltr" className="tabular-nums">{formatDate(fromDate)}</span>
            <span className="mx-3 text-white/70">·</span>
            <span className="text-white/90">بۆ بەرواری :</span>{" "}
            <span dir="ltr" className="tabular-nums">{formatDate(toDate)}</span>
          </>
        )}
      </div>

      {/* Data grid */}
      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
        <table className="w-full border-collapse text-[12px]">
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr className="text-slate-700">
              <Th className="w-[5%]">ژ.وەسڵ</Th>
              <Th className="w-[7%]">کۆدی فرۆشیار</Th>
              <Th className="w-[20%]">ناوی فرۆشیار</Th>
              <Th className="w-[10%]">مۆبایل</Th>
              <Th className="w-[8%]">جۆری وەسڵ</Th>
              <Th className="w-[9%]">بەروار</Th>
              <Th className="w-[10%]">کڕین</Th>
              <Th className="w-[10%]">پارەدان</Th>
              <Th className="w-[8%]">داشکاندن</Th>
              <Th className="w-[8%]">قەرزی کۆن</Th>
              <Th className="w-[5%] text-center">دەستکاری</Th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center text-slate-500 px-3 py-10">
                  هیچ تۆمارێک نییە
                </td>
              </tr>
            )}
            {visibleRows.map((r, i) => (
              <tr
                key={i}
                onClick={() => r.editHref && navigate(r.editHref)}
                className="hover:bg-blue-50 cursor-pointer transition-colors even:bg-slate-50/40"
                title="بۆ دەستکاری کلیک بکە"
              >
                <Td>{r.receiptNo}</Td>
                <Td className="tabular-nums">{r.supplierCode}</Td>
                <Td>{r.name}</Td>
                <Td className="tabular-nums" dirLtr>{r.mobile || "—"}</Td>
                <Td>
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      r.type === "پارەدان"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {r.type === "کڕین" ? "المشتریات" : "المدفوعات"}
                  </span>
                </Td>
                <Td className="tabular-nums" dirLtr>{r.date}</Td>
                <Td className="tabular-nums font-bold" dirLtr>
                  <span style={{ color: BLUE }}>
                    {r.invoiceAmount ? r.invoiceAmount.toLocaleString("en-US") : "0"}
                  </span>
                </Td>
                <Td className="tabular-nums text-rose-700 font-bold" dirLtr>
                  {r.paymentAmount ? r.paymentAmount.toLocaleString("en-US") : "0"}
                </Td>
                <Td className="tabular-nums text-amber-700" dirLtr>
                  {r.discount ? r.discount.toLocaleString("en-US") : "0"}
                </Td>
                <Td className="tabular-nums" dirLtr>
                  {r.oldBalance ? r.oldBalance.toLocaleString("en-US") : "0"}
                </Td>
                <Td className="text-center">
                  {r.editHref && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(r.editHref!); }}
                      className="inline-flex items-center justify-center h-7 w-7 rounded border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 text-blue-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer totals */}
      <div className="border-t-2 border-slate-400 px-3 py-2 grid grid-cols-12 gap-2 text-[12px]" style={{ background: BLUE }}>
        <div className="col-span-3 flex items-stretch border border-slate-400 bg-white rounded">
          <div className="flex-1 font-bold flex items-center px-3 py-2" style={{ background: BLUE_LIGHT, color: BLUE }}>کۆی کڕین</div>
          <div className="w-32 px-3 py-2 text-left tabular-nums font-bold" dir="ltr" style={{ color: BLUE }}>
            {totals.totalPurchases.toLocaleString("en-US")}
          </div>
        </div>
        <div className="col-span-3 flex items-stretch border border-slate-400 bg-white rounded">
          <div className="flex-1 bg-rose-50 text-slate-800 font-bold flex items-center px-3 py-2">کۆی پارەدان</div>
          <div className="w-32 px-3 py-2 text-left tabular-nums font-bold text-rose-700" dir="ltr">
            {totals.totalPaid.toLocaleString("en-US")}
          </div>
        </div>
        <div className="col-span-3 flex items-stretch border border-slate-400 bg-white rounded">
          <div className="flex-1 bg-amber-50 text-slate-800 font-bold flex items-center px-3 py-2">کۆی داشکاندن</div>
          <div className="w-32 px-3 py-2 text-left tabular-nums font-bold text-amber-700" dir="ltr">
            {totals.totalDiscount.toLocaleString("en-US")}
          </div>
        </div>
        <div className="col-span-3 flex items-stretch border-2 border-rose-700 bg-white rounded shadow-inner">
          <div className="flex-1 text-rose-900 font-extrabold flex items-center px-3 py-2">کۆی قەرز</div>
          <div className={`w-32 px-3 py-2 text-left tabular-nums font-extrabold ${totals.finalBalance > 0 ? "text-rose-700" : "text-emerald-700"}`} dir="ltr">
            {totals.finalBalance.toLocaleString("en-US")}
          </div>
        </div>
      </div>

      {/* Print buttons */}
      <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center justify-end gap-2">
        <button
          onClick={() => setMode(isRangeMode ? "print-range" : "print-all")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-white text-sm font-bold"
          style={{ background: BLUE }}
        >
          <Printer className="h-4 w-4" /> چاپکردنی ئەم ڕاپۆرتە
        </button>
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`border-b border-slate-300 px-2 py-2 font-bold text-right ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  dirLtr,
}: {
  children: React.ReactNode;
  className?: string;
  dirLtr?: boolean;
}) {
  return (
    <td
      className={`border-b border-slate-200 px-2 py-1.5 text-right ${className ?? ""}`}
      dir={dirLtr ? "ltr" : undefined}
      style={dirLtr ? { textAlign: "right" } : undefined}
    >
      {children}
    </td>
  );
}
