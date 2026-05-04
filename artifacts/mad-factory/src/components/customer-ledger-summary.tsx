import { useGetCustomerStatement, getGetCustomerStatementQueryKey } from "@workspace/api-client-react";
import { formatMoney } from "@/lib/format";

type Props = {
  customerId: number | null;
  currentInvoiceTotal: number;
  currentPayment: number;
  excludeInvoiceTotal?: number;
  excludeInvoicePaid?: number;
  className?: string;
};

export function CustomerLedgerSummary({
  customerId,
  currentInvoiceTotal,
  currentPayment,
  excludeInvoiceTotal = 0,
  excludeInvoicePaid = 0,
  className = "",
}: Props) {
  const idNum = customerId ?? 0;
  const { data: statement } = useGetCustomerStatement(
    idNum,
    {},
    {
      query: {
        enabled: !!customerId,
        queryKey: getGetCustomerStatementQueryKey(idNum, {}),
        staleTime: 0,
        refetchOnMount: "always",
      },
    },
  );

  const priorDebit = Math.max(0, (statement?.totalDebit ?? 0) - excludeInvoiceTotal);
  const priorCredit = Math.max(0, (statement?.totalCredit ?? 0) - excludeInvoicePaid);
  const opening = statement?.openingBalance ?? 0;

  const totalSales = priorDebit + opening + currentInvoiceTotal;
  const totalPayments = priorCredit + currentPayment;
  const remaining = totalSales - totalPayments;

  return (
    <div
      className={`border-t-2 border-slate-400 bg-slate-50 px-3 py-2 grid grid-cols-12 gap-3 text-[12px] ${className}`}
      dir="rtl"
    >
      {/* LEFT: current invoice total */}
      <div className="col-span-12 md:col-span-5 flex items-stretch border border-slate-400 bg-white">
        <div className="flex-1 bg-indigo-100 text-slate-800 font-bold flex items-center px-3 py-2">
          جمع الکل الفاتورة
          <span className="text-[11px] text-slate-500 mr-1">/ کۆی ئەم پسووڵە</span>
        </div>
        <div
          className="w-44 px-3 py-2 text-left tabular-nums font-extrabold text-slate-900"
          dir="ltr"
        >
          {formatMoney(currentInvoiceTotal)}
        </div>
      </div>

      {/* RIGHT: 3 stacked rows */}
      <div className="col-span-12 md:col-span-7 space-y-1.5">
        <Row
          label="جمع كل المبيعات"
          sub="فرۆش"
          value={formatMoney(totalSales)}
          tone="blue"
        />
        <Row
          label="جمع كل الواصلات"
          sub="پارەدان"
          value={formatMoney(totalPayments)}
          tone="emerald"
        />
        <Row
          label="باقي الحساب"
          sub="قەرز"
          value={formatMoney(remaining)}
          tone={remaining > 0 ? "rose" : "ok"}
          bold
        />
      </div>
    </div>
  );
}

function Row({
  label,
  sub,
  value,
  tone,
  bold,
}: {
  label: string;
  sub: string;
  value: string;
  tone: "blue" | "emerald" | "rose" | "ok";
  bold?: boolean;
}) {
  const bg =
    tone === "blue"
      ? "bg-blue-100"
      : tone === "emerald"
      ? "bg-emerald-100"
      : tone === "rose"
      ? "bg-rose-100"
      : "bg-emerald-50";
  const valColor =
    tone === "rose"
      ? "text-rose-700"
      : tone === "emerald"
      ? "text-emerald-700"
      : tone === "ok"
      ? "text-emerald-700"
      : "text-slate-900";
  return (
    <div className="flex items-stretch border border-slate-400 bg-white">
      <div className={`flex-1 ${bg} text-slate-800 font-bold flex items-center px-3 py-2`}>
        {label}
        <span className="text-[11px] text-slate-500 mr-1">/ {sub}</span>
      </div>
      <div
        className={`w-44 px-3 py-2 text-left tabular-nums ${bold ? "font-extrabold" : "font-bold"} ${valColor}`}
        dir="ltr"
      >
        {value}
      </div>
    </div>
  );
}
