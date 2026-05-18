import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  useListSupplierPayments,
  useCreateSupplierPayment,
  useDeleteSupplierPayment,
  useListSuppliers,
  useListPurchaseInvoices,
  useListExchangeRates,
  getListSupplierPaymentsQueryKey,
  getListSuppliersQueryKey,
  getListPurchaseInvoicesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Save,
  Printer,
  Receipt,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import { PrintStyles } from "@/components/print-styles";
import { SearchableSelect, type Option } from "@/components/searchable-select";

const BLUE = "#2E75B6";
const BLUE_DARK = "#1F5A91";
const BLUE_LIGHT = "#D9E5F1";

type Mode = "view" | "new";

type Draft = {
  supplierId: string;
  amount: string;
  currency: "IQD" | "USD";
  paymentDate: string; // datetime-local
  voucherType: "cash" | "internal";
  notes: string;
};

function nowLocalIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatPaymentDate(s?: string | null): string {
  if (!s) return "—";
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  if (isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${dd}/${mm}/${yy} ${h}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${ampm}`;
}

const emptyDraft = (): Draft => ({
  supplierId: "",
  amount: "",
  currency: "IQD",
  paymentDate: nowLocalIso(),
  voucherType: "cash",
  notes: "",
});

export default function SupplierPayments() {
  const queryClient = useQueryClient();

  const { data: payments, isLoading, refetch } = useListSupplierPayments(
    {},
    { query: { queryKey: getListSupplierPaymentsQueryKey({}) } },
  );
  const { data: suppliers } = useListSuppliers({}, { query: { queryKey: getListSuppliersQueryKey({}) } });
  const sorted = useMemo(() => [...(payments ?? [])].sort((a, b) => b.id - a.id), [payments]);

  const [mode, setMode] = useState<Mode>("view");
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [codeInput, setCodeInput] = useState<string>("");
  const [bigReceipt, setBigReceipt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "view" && index >= sorted.length) {
      setIndex(Math.max(0, sorted.length - 1));
    }
  }, [sorted.length, mode, index]);

  // Deep-link: ?focusId=
  const [focusId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = new URLSearchParams(window.location.search).get("focusId");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  });
  const focusedRef = useRef(false);
  useEffect(() => {
    if (focusedRef.current || focusId === null || sorted.length === 0) return;
    const idx = sorted.findIndex((p) => p.id === focusId);
    if (idx >= 0) {
      setMode("view");
      setIndex(idx);
      focusedRef.current = true;
    }
  }, [focusId, sorted]);

  const current = mode === "view" ? sorted[index] : null;
  const activeSupplierId =
    mode === "new" ? (draft.supplierId ? Number(draft.supplierId) : null) : current?.supplierId ?? null;
  const activeSupplier = useMemo(
    () => (suppliers ?? []).find((s) => s.id === activeSupplierId) ?? null,
    [suppliers, activeSupplierId],
  );

  useEffect(() => {
    if (activeSupplierId !== null) setCodeInput(String(activeSupplierId));
    else if (mode === "new") setCodeInput("");
  }, [activeSupplierId, mode]);

  const { data: allRates } = useListExchangeRates({}, { query: { queryKey: ["exchangeRates", "all"] } });

  // Best rate for the current payment date (exact match → closest before → earliest)
  const rateForDate = useMemo(() => {
    if (!allRates?.length) return null;
    const dateStr = draft.paymentDate.slice(0, 10);
    const sorted = [...allRates].sort(
      (a: { rateDate: string }, b: { rateDate: string }) => b.rateDate.localeCompare(a.rateDate),
    );
    const exact = sorted.find((r: { rateDate: string }) => r.rateDate === dateStr);
    if (exact) return exact;
    const before = sorted.find((r: { rateDate: string }) => r.rateDate <= dateStr);
    return before ?? sorted[sorted.length - 1];
  }, [allRates, draft.paymentDate]);

  const { data: purchaseInvoices } = useListPurchaseInvoices(
    { supplierId: activeSupplierId ?? 0 },
    {
      query: {
        enabled: !!activeSupplierId,
        queryKey: getListPurchaseInvoicesQueryKey({ supplierId: activeSupplierId ?? 0 }),
      },
    },
  );

  const supplierOptions = useMemo<Option[]>(
    () =>
      (suppliers ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
        sub: String(s.id),
        haystack: `${s.name} ${s.id} ${s.phone ?? ""}`,
      })),
    [suppliers],
  );

  // ── Debt logic (We owe supplier) — IQD basis ──────────────────────────────
  const supplierCurrentDebt = activeSupplier
    ? Math.max(0, (activeSupplier.openingBalance ?? 0) + activeSupplier.totalDebt - activeSupplier.totalPaid)
    : 0;
  const paidAmount =
    mode === "new" ? Number(draft.amount || 0) : Number((current as any)?.amountIqd ?? current?.amount ?? 0);
  const debtBeforeThisPayment = mode === "view" ? supplierCurrentDebt + paidAmount : supplierCurrentDebt;
  const remainingAfter = Math.max(0, debtBeforeThisPayment - paidAmount);

  const { mutate: create, isPending: creating } = useCreateSupplierPayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSupplierPaymentsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: ["cashboxSummary"] });
        setMode("view");
        setIndex(0);
        setDraft(emptyDraft());
        setError(null);
      },
      onError: (e: any) => setError(e?.message || "هەڵە لە تۆمارکردندا ڕوویدا"),
    },
  });

  const { mutate: deletePayment, isPending: deleting } = useDeleteSupplierPayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSupplierPaymentsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey({}) });
        setIndex((i) => Math.max(0, i - 1));
      },
    },
  });

  const handleSave = () => {
    if (!draft.supplierId || !draft.amount || Number(draft.amount) <= 0 || !draft.paymentDate) {
      setError("تکایە فرۆشیار، بڕی پارە و بەروار پڕبکەرەوە");
      return;
    }
    setError(null);
    create({
      data: {
        supplierId: Number(draft.supplierId),
        amount: Number(draft.amount),
        currency: draft.currency,
        exchangeRateId: draft.currency === "USD"
          ? (rateForDate as { id?: number } | null)?.id
          : undefined,
        paymentDate: draft.paymentDate,
        voucherType: draft.voucherType,
        notes: draft.notes || undefined,
      },
    });
  };

  const handleDelete = () => {
    if (!current) return;
    if (!confirm(`دڵنیایی لە سڕینەوەی پارەدانی #${current.id} — ${current.supplierName}؟`)) return;
    deletePayment({ id: current.id });
  };

  const handleClose = () => {
    if (mode === "new") {
      setDraft(emptyDraft());
      setMode("view");
    } else {
      window.history.back();
    }
  };

  const enterNewMode = () => {
    setDraft(emptyDraft());
    setMode("new");
    setError(null);
  };

  const handlePrint = () => {
    setBigReceipt(true);
    setTimeout(() => window.print(), 80);
    setTimeout(() => setBigReceipt(false), 600);
  };

  const total = sorted.length;
  const isFirst = index === 0;
  const isLast = index >= total - 1;
  const navDisabled = mode === "new" || total === 0;

  const receiptOptions = useMemo<Option[]>(
    () =>
      (purchaseInvoices ?? []).map((inv) => ({
        value: String(inv.id),
        label: `#${inv.invoiceNumber}`,
        sub: inv.invoiceDate,
        haystack: `${inv.invoiceNumber} ${inv.invoiceDate}`,
      })),
    [purchaseInvoices],
  );

  return (
    <>
      <PrintStyles />
      <div className="max-w-[1100px] mx-auto" dir="rtl">
        <div className="border border-slate-300 rounded-md overflow-hidden bg-white shadow-md print:shadow-none print:border-0">
          {/* Title bar */}
          <div
            className="text-center py-3 text-2xl font-extrabold text-white"
            style={{ background: BLUE }}
          >
            فاتورە الواصلات / پارەدانی فرۆشیار
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
            {/* SIDE — receipt search */}
            <div className="space-y-3 print:hidden order-2 md:order-1">
              <div className="border border-slate-300 rounded-md p-2 bg-slate-50">
                <div className="text-xs font-bold text-slate-700 mb-1.5 text-center">گەڕان بەپێی ژ.وەسڵ</div>
                <SearchableSelect
                  value=""
                  onChange={(v) => {
                    if (!v) return;
                    const inv = (purchaseInvoices ?? []).find((s) => String(s.id) === v);
                    if (inv) window.location.href = `/purchases/${inv.id}`;
                  }}
                  options={receiptOptions}
                  placeholder="ژ.وەسڵ هەڵبژێرە"
                  buttonClassName="h-8 text-xs bg-white"
                />
                {!activeSupplierId && (
                  <div className="text-[10px] text-slate-500 mt-1.5 leading-tight text-center">
                    سەرەتا فرۆشیارێک هەڵبژێرە
                  </div>
                )}
              </div>
            </div>

            {/* FORM */}
            <div className="space-y-2 order-1 md:order-2">
              <FieldRow label="رقم الوصل / وەسڵ" theme={BLUE_LIGHT}>
                <div className="px-2 py-1.5 text-left tabular-nums font-bold text-slate-800" dir="ltr">
                  {mode === "new" ? "(نوێ)" : current ? current.id : ""}
                </div>
              </FieldRow>

              <FieldRow label="کد المورد / فرۆشیار" theme={BLUE_LIGHT}>
                {mode === "new" ? (
                  <Input
                    type="number"
                    value={codeInput}
                    onChange={(e) => {
                      setCodeInput(e.target.value);
                      const id = Number(e.target.value);
                      if (Number.isFinite(id) && id > 0 && (suppliers ?? []).some((s) => s.id === id)) {
                        setDraft((d) => ({ ...d, supplierId: String(id) }));
                      } else {
                        setDraft((d) => ({ ...d, supplierId: "" }));
                      }
                    }}
                    className="h-8 px-2 border-0 rounded-none text-left tabular-nums focus-visible:ring-1 focus-visible:ring-blue-500 bg-white"
                    dir="ltr"
                    placeholder="0"
                  />
                ) : (
                  <div className="px-2 py-1.5 text-left tabular-nums font-bold text-slate-800" dir="ltr">
                    {activeSupplierId ?? ""}
                  </div>
                )}
              </FieldRow>

              <FieldRow label="اسم المورد / فرۆشیار" theme={BLUE_LIGHT}>
                {mode === "new" ? (
                  <SearchableSelect
                    value={draft.supplierId}
                    onChange={(v) => setDraft({ ...draft, supplierId: v })}
                    options={supplierOptions}
                    placeholder="ناوی فرۆشیار هەڵبژێرە یان بنووسە..."
                    buttonClassName="h-8 px-2 rounded-none border-0 bg-white"
                  />
                ) : (
                  <div className="px-2 py-1.5 font-bold text-slate-800">
                    {activeSupplier?.name ?? current?.supplierName ?? ""}
                  </div>
                )}
              </FieldRow>

              <FieldRow label="مۆبایل" theme={BLUE_LIGHT}>
                <div className="px-2 py-1.5 tabular-nums text-slate-700" dir="ltr">
                  {activeSupplier?.phone ?? ""}
                </div>
              </FieldRow>

              <FieldRow label="عنوان / ناونیشان" theme={BLUE_LIGHT}>
                <div className="px-2 py-1.5 text-slate-700">
                  {activeSupplier?.address ?? ""}
                </div>
              </FieldRow>

              <FieldRow label="دراو / Currency" theme={BLUE_LIGHT}>
                {mode === "new" ? (
                  <div className="flex gap-1.5 items-center px-2 py-1">
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, currency: "IQD" })}
                      className={`h-7 px-3 text-xs rounded font-bold border ${draft.currency === "IQD" ? "text-white border-blue-700" : "bg-white text-slate-700 border-slate-300"}`}
                      style={draft.currency === "IQD" ? { background: BLUE } : undefined}
                    >
                      د.ع
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, currency: "USD" })}
                      className={`h-7 px-3 text-xs rounded font-bold border ${draft.currency === "USD" ? "text-white border-blue-700" : "bg-white text-slate-700 border-slate-300"}`}
                      style={draft.currency === "USD" ? { background: BLUE } : undefined}
                    >
                      $
                    </button>
                  </div>
                ) : (
                  <div className="px-2 py-1.5 font-bold text-slate-800" dir="ltr">{current?.currency ?? "IQD"}</div>
                )}
              </FieldRow>

              <FieldRow label="تاریخ / بەروار" theme={BLUE_LIGHT}>
                {mode === "new" ? (
                  <Input
                    type="datetime-local"
                    value={draft.paymentDate}
                    onChange={(e) => setDraft({ ...draft, paymentDate: e.target.value })}
                    className="h-8 px-2 border-0 rounded-none focus-visible:ring-1 focus-visible:ring-blue-500 bg-white tabular-nums"
                    dir="ltr"
                  />
                ) : (
                  <div className="px-2 py-1.5 tabular-nums text-slate-800" dir="ltr">
                    {formatPaymentDate(current?.paymentDate)}
                  </div>
                )}
              </FieldRow>

              <FieldRow label="الملاحظات / تێبینی" theme={BLUE_LIGHT}>
                {mode === "new" ? (
                  <Input
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    className="h-8 px-2 border-0 rounded-none focus-visible:ring-1 focus-visible:ring-blue-500 bg-white"
                    placeholder="تێبینی..."
                  />
                ) : (
                  <div className="px-2 py-1.5 text-slate-700">{current?.notes || ""}</div>
                )}
              </FieldRow>

              <div className="mt-4 max-w-md ms-auto">
                <DebtRow label="الدین / قەرزی" value={debtBeforeThisPayment} tone="warn" />
                <DebtRow
                  label="پارەدان"
                  value={paidAmount}
                  tone="primary"
                  editable={mode === "new"}
                  inputValue={draft.amount}
                  onChange={(v) => setDraft({ ...draft, amount: v })}
                />
                <DebtRow label="قەرزی ماوە" value={remainingAfter} tone="danger" />
              </div>

              {error && (
                <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-300 rounded px-2 py-1.5">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="border-t border-slate-300 px-3 py-3 bg-slate-50 print:hidden flex flex-wrap items-center gap-2 justify-end">
            <ActionBtn onClick={handleClose} bg="#E5E7EB" color="#1F2937" border="#9CA3AF">داخستن</ActionBtn>
            {mode === "new" ? (
              <ActionBtn onClick={handleSave} disabled={creating} bg={BLUE} color="white" border={BLUE_DARK}>
                <Save className="h-3.5 w-3.5 inline-block ms-1 -mt-0.5" />
                {creating ? "تۆمارکردن..." : "کردنەوە"}
              </ActionBtn>
            ) : (
              <ActionBtn onClick={handleDelete} disabled={!current || deleting} bg="#DC2626" color="white" border="#991B1B">
                <Trash2 className="h-3.5 w-3.5 inline-block ms-1 -mt-0.5" /> سڕینەوە
              </ActionBtn>
            )}
            <ActionBtn onClick={handlePrint} disabled={!current} bg="#F59E0B" color="white" border="#B45309">
              <Printer className="h-3.5 w-3.5 inline-block ms-1 -mt-0.5" /> وەسڵ - گەورە
            </ActionBtn>
            <ActionBtn onClick={() => refetch()} bg="#FBBF24" color="#1F2937" border="#D97706">
              <RefreshCw className="h-3.5 w-3.5 inline-block ms-1 -mt-0.5" /> ڕێفرێش
            </ActionBtn>

            <div className="flex items-center gap-0.5 px-2 border border-slate-300 rounded bg-white">
              <NavBtn onClick={() => setIndex((i) => Math.min(total - 1, i + 1))} disabled={navDisabled || isLast}>
                <ChevronRight className="h-4 w-4" />
              </NavBtn>
              <NavBtn onClick={() => setIndex(total - 1)} disabled={navDisabled || isLast}>
                <ChevronsRight className="h-4 w-4" />
              </NavBtn>
              <span className="px-2 text-[11px] text-slate-500 tabular-nums" dir="ltr">
                {total > 0 && mode === "view" ? index + 1 : "—"} / {total}
              </span>
              <NavBtn onClick={() => setIndex(0)} disabled={navDisabled || isFirst}>
                <ChevronsLeft className="h-4 w-4" />
              </NavBtn>
              <NavBtn onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={navDisabled || isFirst}>
                <ChevronLeft className="h-4 w-4" />
              </NavBtn>
            </div>

            <ActionBtn onClick={enterNewMode} bg={BLUE} color="white" border={BLUE_DARK}>
              <Plus className="h-3.5 w-3.5 inline-block ms-1 -mt-0.5" /> زیاد کردن
            </ActionBtn>
          </div>

          {isLoading && (
            <div className="text-center text-xs text-slate-500 py-2">بارکردن...</div>
          )}
        </div>
      </div>

      {bigReceipt && current && (
        <BigReceipt
          theme={BLUE}
          themeText="text-blue-900"
          title="پسووڵەی پارەدانی فرۆشیار"
          payment={current}
          partyLabel="فرۆشیار"
          partyName={activeSupplier?.name ?? current.supplierName}
          partyPhone={activeSupplier?.phone ?? null}
          partyAddress={activeSupplier?.address ?? null}
          previousDebt={debtBeforeThisPayment}
          remaining={remainingAfter}
        />
      )}
    </>
  );
}

// ─── Reusable atoms ──────────────────────────────────────────────────────────
function FieldRow({ label, theme, children }: { label: string; theme: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] border border-slate-300 rounded overflow-hidden bg-white">
      <div
        className="px-3 py-1.5 text-right text-sm font-bold text-slate-800 border-l border-slate-300"
        style={{ background: theme }}
      >
        {label}
      </div>
      <div className="min-h-[34px] flex items-stretch">{children}</div>
    </div>
  );
}

function DebtRow({
  label, value, tone, editable, inputValue, onChange,
}: {
  label: string;
  value: number;
  tone: "warn" | "primary" | "danger";
  editable?: boolean;
  inputValue?: string;
  onChange?: (v: string) => void;
}) {
  const labelBg =
    tone === "warn" ? "bg-amber-50 text-amber-900" :
    tone === "primary" ? "bg-sky-50 text-sky-900" :
    "bg-rose-50 text-rose-900";
  const valueColor =
    tone === "warn" ? "text-amber-800" :
    tone === "primary" ? "text-sky-800" :
    "text-rose-800";
  return (
    <div className="grid grid-cols-[140px_1fr] border border-slate-300 -mt-px first:mt-0 bg-white">
      <div className={`px-3 py-1.5 text-sm font-bold text-right border-l border-slate-300 ${labelBg}`}>{label}</div>
      <div className="px-2 py-1 flex items-center justify-end">
        {editable ? (
          <Input
            type="number"
            value={inputValue ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            className="h-7 w-full text-left tabular-nums font-bold border-slate-300"
            dir="ltr"
            placeholder="0"
          />
        ) : (
          <span className={`text-sm font-bold tabular-nums ${valueColor}`} dir="ltr">
            {formatMoney(value)}
          </span>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  onClick, disabled, children, bg, color = "#0F172A", border,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  bg: string;
  color?: string;
  border?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-8 px-3 text-xs font-extrabold rounded shadow-sm hover:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
      style={{ background: bg, color, border: border ? `1px solid ${border}` : undefined }}
    >
      {children}
    </button>
  );
}

function NavBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-6 w-6 flex items-center justify-center rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700"
    >
      {children}
    </button>
  );
}

function BigReceipt({
  theme, themeText, title, payment, partyLabel, partyName, partyPhone, partyAddress, previousDebt, remaining,
}: {
  theme: string;
  themeText: string;
  title: string;
  payment: { id: number; amount: number | string; amountIqd?: number | string; currency?: string; paymentDate: string; notes?: string | null };
  partyLabel: string;
  partyName: string;
  partyPhone: string | null;
  partyAddress: string | null;
  previousDebt: number;
  remaining: number;
}) {
  const amountIqd = Number(payment.amountIqd ?? payment.amount ?? 0);
  return (
    <div className="print-area fixed inset-0 bg-white z-50 p-10 hidden print:block" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <div className="text-center pb-4 mb-6 border-b-2" style={{ borderColor: theme }}>
          <h1 className={`text-3xl font-bold ${themeText}`}>کارگەی خشتی ماد</h1>
          <p className="text-sm text-slate-600 mt-1 flex items-center justify-center gap-2">
            <Receipt className="h-4 w-4" /> {title}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div><b>ژمارەی وەسڵ:</b> #{payment.id}</div>
          <div><b>بەروار:</b> <span dir="ltr">{formatPaymentDate(payment.paymentDate)}</span></div>
          <div><b>ناوی {partyLabel}:</b> {partyName}</div>
          <div><b>دراو:</b> <span dir="ltr">{payment.currency ?? "IQD"}</span></div>
          <div><b>مۆبایل:</b> <span dir="ltr">{partyPhone ?? "—"}</span></div>
          <div><b>ناونیشان:</b> {partyAddress ?? "—"}</div>
        </div>
        <table className="w-full border-collapse text-sm mb-8">
          <tbody>
            <tr><td className="border px-3 py-2 bg-amber-50 font-bold w-1/2">قەرزی پێشوو</td><td className="border px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(previousDebt)}</td></tr>
            <tr><td className="border px-3 py-2 bg-sky-50 font-bold">پارەدراو</td><td className="border px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(amountIqd)}</td></tr>
            <tr><td className="border px-3 py-2 bg-rose-50 font-bold">قەرزی ماوە</td><td className="border px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(remaining)}</td></tr>
          </tbody>
        </table>
        {payment.notes && <div className="text-sm mb-8"><b>تێبینی:</b> {payment.notes}</div>}
        <div className="grid grid-cols-2 gap-12 mt-16 text-center text-sm">
          <div><div className="border-t border-slate-400 pt-2">واژووی پێدەر</div></div>
          <div><div className="border-t border-slate-400 pt-2">واژووی {partyLabel}</div></div>
        </div>
      </div>
    </div>
  );
}
