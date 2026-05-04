import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useListCustomerPayments,
  useCreateCustomerPayment,
  useDeleteCustomerPayment,
  useListCustomers,
  getListCustomerPaymentsQueryKey,
  getListCustomersQueryKey,
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
  Search,
  X,
  Save,
  Receipt,
  Printer,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import { PrintStyles } from "@/components/print-styles";
import { EntityPicker } from "@/components/entity-picker";

type Mode = "view" | "new";

type Draft = {
  customerId: string;
  amount: string;
  paymentDate: string;
  voucherType: "cash" | "internal";
  notes: string;
};

const emptyDraft = (): Draft => ({
  customerId: "",
  amount: "",
  paymentDate: new Date().toISOString().split("T")[0],
  voucherType: "cash",
  notes: "",
});

export default function CustomerPayments() {
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: payments, isLoading, refetch } = useListCustomerPayments(
    {},
    { query: { queryKey: getListCustomerPaymentsQueryKey({}) } },
  );
  const { data: customers } = useListCustomers({}, { query: { queryKey: getListCustomersQueryKey({}) } });

  const sorted = useMemo(
    () => [...(payments ?? [])].sort((a, b) => b.id - a.id),
    [payments],
  );

  const [mode, setMode] = useState<Mode>("view");
  const [index, setIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [bigReceipt, setBigReceipt] = useState(false);

  // Keep index inside bounds when list updates
  useEffect(() => {
    if (mode === "view" && index >= sorted.length) {
      setIndex(Math.max(0, sorted.length - 1));
    }
  }, [sorted.length, mode, index]);

  const current = mode === "view" ? sorted[index] : null;
  const currentCustomer = useMemo(() => {
    const id = mode === "new" ? Number(draft.customerId) : current?.customerId;
    return customers?.find((c) => c.id === id);
  }, [customers, current, draft.customerId, mode]);

  const previousDebt = currentCustomer
    ? Math.max(0, (currentCustomer.openingBalance ?? 0) + currentCustomer.totalDebt - currentCustomer.totalPaid)
    : 0;
  const paidAmount = mode === "new" ? Number(draft.amount || 0) : current?.amount ?? 0;
  // In view mode, previousDebt already EXCLUDES this payment (it was added to totalPaid).
  // So display previousDebt + this payment as the "before" debt and previousDebt as remaining.
  const debtBeforeThisPayment = mode === "view" ? previousDebt + paidAmount : previousDebt;
  const remainingAfter = mode === "view" ? previousDebt : Math.max(0, previousDebt - paidAmount);

  const { mutate: create, isPending: creating } = useCreateCustomerPayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomerPaymentsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: ["cashboxSummary"] });
        setMode("view");
        setIndex(0);
        setDraft(emptyDraft());
      },
    },
  });

  const { mutate: deletePayment, isPending: deleting } = useDeleteCustomerPayment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCustomerPaymentsQueryKey({}) });
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey({}) });
        setIndex((i) => Math.max(0, i - 1));
      },
    },
  });

  const enterNewMode = () => {
    setDraft(emptyDraft());
    setMode("new");
  };
  const cancelNew = () => {
    setDraft(emptyDraft());
    setMode("view");
  };
  const handleSave = () => {
    if (!draft.customerId || !draft.amount || Number(draft.amount) <= 0 || !draft.paymentDate) return;
    create({
      data: {
        customerId: Number(draft.customerId),
        amount: Number(draft.amount),
        paymentDate: draft.paymentDate,
        voucherType: draft.voucherType,
        notes: draft.notes || undefined,
      },
    });
  };
  const handleDelete = () => {
    if (!current) return;
    if (!confirm(`دڵنیایی لە سڕینەوەی ئەم پارەدانە؟ (#${current.id} — ${currentCustomer?.name ?? current.customerName})`)) return;
    deletePayment({ id: current.id });
  };
  const handleSearch = () => {
    const q = search.trim();
    if (!q) return;
    const id = Number(q);
    if (Number.isFinite(id) && id > 0) {
      const idx = sorted.findIndex((p) => p.id === id);
      if (idx >= 0) {
        setMode("view");
        setIndex(idx);
        return;
      }
    }
    const lower = q.toLowerCase();
    const idx = sorted.findIndex((p) => (p.customerName ?? "").toLowerCase().includes(lower));
    if (idx >= 0) {
      setMode("view");
      setIndex(idx);
    } else {
      alert("هیچ تۆمارێک نەدۆزرایەوە");
    }
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

  return (
    <>
      <PrintStyles />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start print:block">
        {/* Mad Access-style form card */}
        <div className="rounded-xl overflow-hidden shadow-lg border border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-700 print:shadow-none print:border-0 print:max-w-none">
          {/* Header */}
          <div className="bg-gradient-to-l from-emerald-700 via-emerald-600 to-teal-600 text-white px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              <span className="text-base font-bold">
                {mode === "new" ? "تۆمارکردنی پارەدانی نوێ" : "پسووڵەی پارەدانی کڕیار"}
              </span>
            </div>
            <div className="text-xs text-white/90 tabular-nums" dir="ltr">
              {mode === "view" && total > 0 ? `${index + 1} / ${total}` : mode === "new" ? "نوێ" : "0 / 0"}
            </div>
          </div>

          {/* Form body */}
          <div ref={printRef} className="p-5 space-y-3">
            <FormRow label="ژمارەی وەسڵ">
              <ReadValue value={mode === "new" ? "نوێ" : current ? `#${current.id}` : "—"} />
            </FormRow>

            <FormRow label="کڕیار">
              {mode === "new" ? (
                <EntityPicker
                  entities={customers}
                  value={draft.customerId ? Number(draft.customerId) : null}
                  onChange={(id) => setDraft({ ...draft, customerId: String(id) })}
                  placeholder="کڕیار هەڵبژێرە..."
                  searchPlaceholder="گەڕان بە ناو، کۆد، یان مۆبایل..."
                />
              ) : (
                <ReadValue
                  value={
                    currentCustomer
                      ? `#${currentCustomer.id} — ${currentCustomer.name}`
                      : current
                      ? `#${current.customerId} — ${current.customerName}`
                      : "—"
                  }
                  bold
                />
              )}
            </FormRow>

            <FormRow label="مۆبایل">
              <ReadValue value={currentCustomer?.phone ?? "—"} dir="ltr" />
            </FormRow>

            <FormRow label="ناونیشان">
              <ReadValue value={currentCustomer?.address ?? "—"} />
            </FormRow>

            <FormRow label="بەروار">
              {mode === "new" ? (
                <Input
                  type="date"
                  value={draft.paymentDate}
                  onChange={(e) => setDraft({ ...draft, paymentDate: e.target.value })}
                  className="h-9"
                  dir="ltr"
                />
              ) : (
                <ReadValue value={current?.paymentDate ?? "—"} dir="ltr" />
              )}
            </FormRow>

            <FormRow label="جۆری وەسڵ">
              {mode === "new" ? (
                <select
                  value={draft.voucherType}
                  onChange={(e) => setDraft({ ...draft, voucherType: e.target.value as "cash" | "internal" })}
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                >
                  <option value="cash">وەسڵی نەختی</option>
                  <option value="internal">وەسڵی ناوخۆیی</option>
                </select>
              ) : (
                <ReadValue value={(current as any)?.voucherType === "internal" ? "وەسڵی ناوخۆیی" : "وەسڵی نەختی"} />
              )}
            </FormRow>

            <FormRow label="تێبینی">
              {mode === "new" ? (
                <Input
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="تێبینی..."
                  className="h-9"
                />
              ) : (
                <ReadValue value={current?.notes || "—"} />
              )}
            </FormRow>

            {/* Debt Summary */}
            <div className="mt-5 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <SummaryRow label="قەرزی پێشوو" value={debtBeforeThisPayment} tone="warning" />
              <SummaryRow
                label="پارەدان"
                value={paidAmount}
                tone="primary"
                editable={mode === "new"}
                onChange={(v) => setDraft({ ...draft, amount: v })}
                inputValue={draft.amount}
              />
              <SummaryRow label="قەرزی ماوە" value={remainingAfter} tone="danger" />
            </div>
          </div>
        </div>

        {/* Side action panel — vertical, sticky on desktop */}
        <div className="lg:sticky lg:top-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 print:hidden space-y-3">
          {/* Search */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">گەڕان</div>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="ژ.وەسڵ یان ناو..."
              className="h-9"
            />
            <Button
              onClick={handleSearch}
              variant="secondary"
              className="w-full gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-100"
            >
              <Search className="h-4 w-4" />
              گەڕان
            </Button>
          </div>

          {/* Navigation */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">گەشت بەسەر تۆمارەکاندا</div>
            <div className="flex items-center justify-between gap-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-1">
              <NavBtn onClick={() => setIndex(0)} disabled={navDisabled || isFirst}>
                <ChevronsRight className="h-4 w-4" />
              </NavBtn>
              <NavBtn onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={navDisabled || isFirst}>
                <ChevronRight className="h-4 w-4" />
              </NavBtn>
              <span className="px-2 text-xs text-slate-500 tabular-nums" dir="ltr">
                {total > 0 && mode === "view" ? index + 1 : "—"} / {total}
              </span>
              <NavBtn onClick={() => setIndex((i) => Math.min(total - 1, i + 1))} disabled={navDisabled || isLast}>
                <ChevronLeft className="h-4 w-4" />
              </NavBtn>
              <NavBtn onClick={() => setIndex(total - 1)} disabled={navDisabled || isLast}>
                <ChevronsLeft className="h-4 w-4" />
              </NavBtn>
            </div>
          </div>

          {/* Action buttons — vertical stack */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">کردارەکان</div>

            {mode === "view" ? (
              <>
                <Button
                  onClick={enterNewMode}
                  className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="h-4 w-4" />
                  پارەدانی نوێ
                </Button>
                <Button
                  onClick={handlePrint}
                  disabled={!current}
                  variant="secondary"
                  className="w-full gap-1.5 bg-yellow-200 hover:bg-yellow-300 text-yellow-900 border border-yellow-400 disabled:opacity-50"
                >
                  <Printer className="h-4 w-4" />
                  چاپی وەسڵ
                </Button>
                <Button
                  onClick={() => refetch()}
                  variant="secondary"
                  className="w-full gap-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-100"
                >
                  <RefreshCw className="h-4 w-4" />
                  ڕیفرێش
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={!current || deleting}
                  variant="secondary"
                  className="w-full gap-1.5 bg-orange-500 hover:bg-orange-600 text-white border border-orange-600"
                >
                  <Trash2 className="h-4 w-4" />
                  سڕینەوە
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleSave}
                  disabled={creating || !draft.customerId || !draft.amount}
                  className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Save className="h-4 w-4" />
                  {creating ? "تۆمارکردن..." : "تۆمارکردن"}
                </Button>
                <Button
                  onClick={cancelNew}
                  variant="outline"
                  className="w-full gap-1.5"
                >
                  <X className="h-4 w-4" />
                  پاشگەزبوونەوە
                </Button>
              </>
            )}
          </div>

          {isLoading && (
            <div className="text-center text-xs text-slate-500">بارکردن...</div>
          )}
          {!isLoading && total === 0 && mode === "view" && (
            <div className="text-center text-xs text-slate-500 leading-5 px-2">
              هیچ تۆمارێک نییە. کلیک لە «پارەدانی نوێ» بکە.
            </div>
          )}
        </div>

        {/* Big receipt overlay (used for printing only) */}
        {bigReceipt && current && (
          <BigReceipt payment={current} customer={currentCustomer} previousDebt={debtBeforeThisPayment} remaining={remainingAfter} />
        )}
      </div>
    </>
  );
}

// ── Reusable components ────────────────────────────────────────

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-0 rounded-md overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 px-3 py-2 text-sm font-semibold border-l border-slate-200 dark:border-slate-700 text-right">
        {label}
      </div>
      <div className="bg-white dark:bg-slate-950 px-3 py-1.5 flex items-center min-h-[38px]">
        {children}
      </div>
    </div>
  );
}

function ReadValue({ value, bold, dir }: { value: string; bold?: boolean; dir?: "ltr" | "rtl" }) {
  return (
    <span
      className={`text-sm ${bold ? "font-bold" : ""} text-slate-800 dark:text-slate-100`}
      dir={dir}
    >
      {value}
    </span>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  editable,
  onChange,
  inputValue,
}: {
  label: string;
  value: number;
  tone: "warning" | "primary" | "danger";
  editable?: boolean;
  onChange?: (v: string) => void;
  inputValue?: string;
}) {
  const labelBg =
    tone === "warning"
      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-900"
      : tone === "primary"
      ? "bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-100 border-sky-200 dark:border-sky-900"
      : "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 border-rose-200 dark:border-rose-900";

  const valueColor =
    tone === "warning" ? "text-amber-700 dark:text-amber-300"
    : tone === "primary" ? "text-sky-700 dark:text-sky-300"
    : "text-rose-700 dark:text-rose-300";

  return (
    <div className={`grid grid-cols-[160px_1fr] border-b last:border-b-0 ${labelBg}`}>
      <div className="px-3 py-2 text-sm font-bold border-l text-right">{label}</div>
      <div className="bg-white dark:bg-slate-950 px-3 py-1.5 flex items-center min-h-[40px] justify-end">
        {editable ? (
          <Input
            type="number"
            value={inputValue ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder="0"
            className="h-8 w-40 text-left tabular-nums font-bold"
            dir="ltr"
          />
        ) : (
          <span className={`text-base font-bold tabular-nums ${valueColor}`} dir="ltr">
            {formatMoney(value)}
          </span>
        )}
      </div>
    </div>
  );
}

function NavBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200"
    >
      {children}
    </button>
  );
}

// Big A4 printable receipt
function BigReceipt({
  payment,
  customer,
  previousDebt,
  remaining,
}: {
  payment: { id: number; customerName: string; amount: number; paymentDate: string; notes?: string | null };
  customer?: { id: number; name: string; phone?: string | null; address?: string | null } | undefined;
  previousDebt: number;
  remaining: number;
}) {
  return (
    <div className="print-area fixed inset-0 bg-white z-50 p-10 hidden print:block" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <div className="text-center border-b-2 border-emerald-700 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-emerald-800">کارگەی خشتی ماد</h1>
          <p className="text-sm text-slate-600 mt-1">پسووڵەی پارەدانی کڕیار</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div><b>ژمارەی وەسڵ:</b> #{payment.id}</div>
          <div><b>بەروار:</b> <span dir="ltr">{payment.paymentDate}</span></div>
          <div><b>ناوی کڕیار:</b> {customer?.name ?? payment.customerName}</div>
          <div><b>کۆدی کڕیار:</b> {customer?.id ?? "—"}</div>
          <div><b>مۆبایل:</b> <span dir="ltr">{customer?.phone ?? "—"}</span></div>
          <div><b>ناونیشان:</b> {customer?.address ?? "—"}</div>
        </div>

        <table className="w-full border-collapse text-sm mb-8">
          <tbody>
            <tr><td className="border px-3 py-2 bg-amber-50 font-bold w-1/2">قەرزی پێشوو</td><td className="border px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(previousDebt)}</td></tr>
            <tr><td className="border px-3 py-2 bg-sky-50 font-bold">پارەدراو</td><td className="border px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(payment.amount)}</td></tr>
            <tr><td className="border px-3 py-2 bg-rose-50 font-bold">قەرزی ماوە</td><td className="border px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(remaining)}</td></tr>
          </tbody>
        </table>

        {payment.notes && (
          <div className="text-sm mb-8"><b>تێبینی:</b> {payment.notes}</div>
        )}

        <div className="grid grid-cols-2 gap-12 mt-16 text-center text-sm">
          <div>
            <div className="border-t border-slate-400 pt-2">واژووی وەرگر</div>
          </div>
          <div>
            <div className="border-t border-slate-400 pt-2">واژووی کڕیار</div>
          </div>
        </div>
      </div>
    </div>
  );
}
