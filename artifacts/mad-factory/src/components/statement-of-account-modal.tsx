import { useMemo } from "react";
import { useLocation } from "wouter";
import { Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney, formatDate } from "@/lib/format";
import {
  useGetCustomer,
  useGetSupplier,
  useGetCustomerStatement,
  useGetSupplierStatement,
  useListSalesInvoices,
  useListPurchaseInvoices,
  useListCustomerPayments,
  useListSupplierPayments,
  getGetCustomerQueryKey,
  getGetSupplierQueryKey,
  getGetCustomerStatementQueryKey,
  getGetSupplierStatementQueryKey,
  getListSalesInvoicesQueryKey,
  getListPurchaseInvoicesQueryKey,
  getListCustomerPaymentsQueryKey,
  getListSupplierPaymentsQueryKey,
} from "@workspace/api-client-react";

type Props = {
  open: boolean;
  onClose: () => void;
  kind: "customer" | "supplier";
  entityId: number | null;
};

type Row = {
  date: string;
  receiptNo: string;
  name: string;
  mobile: string;
  type: string;
  invoiceAmount: number;
  paymentAmount: number;
  discount: number;
  oldBalance: number;
  editHref: string | null;
};

export function StatementOfAccountModal({ open, onClose, kind, entityId }: Props) {
  const [, navigate] = useLocation();
  const idNum = entityId ?? 0;
  const enabled = open && !!entityId;

  // Customer-side hooks (always called; gated by `enabled`)
  const { data: customer } = useGetCustomer(idNum, {
    query: { enabled: enabled && kind === "customer", queryKey: getGetCustomerQueryKey(idNum) },
  });
  const { data: custStmt } = useGetCustomerStatement(
    idNum,
    {},
    {
      query: {
        enabled: enabled && kind === "customer",
        queryKey: getGetCustomerStatementQueryKey(idNum, {}),
        staleTime: 0,
        refetchOnMount: "always",
      },
    },
  );
  const { data: salesInvoices } = useListSalesInvoices(
    { customerId: idNum },
    {
      query: {
        enabled: enabled && kind === "customer",
        queryKey: getListSalesInvoicesQueryKey({ customerId: idNum }),
        staleTime: 0,
      },
    },
  );
  const { data: custPayments } = useListCustomerPayments(
    { customerId: idNum },
    {
      query: {
        enabled: enabled && kind === "customer",
        queryKey: getListCustomerPaymentsQueryKey({ customerId: idNum }),
        staleTime: 0,
      },
    },
  );

  // Supplier-side hooks
  const { data: supplier } = useGetSupplier(idNum, {
    query: { enabled: enabled && kind === "supplier", queryKey: getGetSupplierQueryKey(idNum) },
  });
  const { data: supStmt } = useGetSupplierStatement(
    idNum,
    {},
    {
      query: {
        enabled: enabled && kind === "supplier",
        queryKey: getGetSupplierStatementQueryKey(idNum, {}),
        staleTime: 0,
        refetchOnMount: "always",
      },
    },
  );
  const { data: purchaseInvoices } = useListPurchaseInvoices(
    { supplierId: idNum },
    {
      query: {
        enabled: enabled && kind === "supplier",
        queryKey: getListPurchaseInvoicesQueryKey({ supplierId: idNum }),
        staleTime: 0,
      },
    },
  );
  const { data: supPayments } = useListSupplierPayments(
    { supplierId: idNum },
    {
      query: {
        enabled: enabled && kind === "supplier",
        queryKey: getListSupplierPaymentsQueryKey({ supplierId: idNum }),
        staleTime: 0,
      },
    },
  );

  const entity = kind === "customer" ? customer : supplier;
  const stmt = kind === "customer" ? custStmt : supStmt;
  const entityName = entity?.name ?? "";
  const entityMobile = entity?.phone ?? "";
  const openingBalance = stmt?.openingBalance ?? Number(entity?.openingBalance ?? 0);
  const invoiceLabel = kind === "customer" ? "فرۆشتن" : "کڕین";

  const rows = useMemo<Row[]>(() => {
    if (!enabled) return [];

    const out: Row[] = [];

    if (kind === "customer") {
      (salesInvoices ?? []).forEach((inv) => {
        out.push({
          date: inv.invoiceDate,
          receiptNo: inv.invoiceNumber,
          name: inv.customerName ?? entityName,
          mobile: inv.customerMobile ?? entityMobile,
          type: invoiceLabel,
          invoiceAmount: Number(inv.subtotal ?? inv.total + (inv.discount ?? 0)),
          paymentAmount: Number(inv.paidAmount ?? 0),
          discount: Number(inv.discount ?? 0),
          oldBalance: 0,
          editHref: `/sales/${inv.id}`,
        });
      });
      (custPayments ?? []).forEach((p) => {
        out.push({
          date: p.paymentDate,
          receiptNo: `پ-${p.id}`,
          name: p.customerName || entityName,
          mobile: entityMobile,
          type: "پارەدان",
          invoiceAmount: 0,
          paymentAmount: Number(p.amount ?? 0),
          discount: 0,
          oldBalance: 0,
          editHref: `/customer-payments`,
        });
      });
    } else {
      (purchaseInvoices ?? []).forEach((inv) => {
        // Normalize everything to IQD. USD invoices carry exchangeRateValue.
        const fx = inv.currency === "USD" ? Number(inv.exchangeRateValue ?? 1) : 1;
        const discountIqd = Number(inv.discount ?? 0) * fx;
        const sub = Number(inv.subtotalIqd ?? (Number(inv.subtotal ?? 0) * fx));
        out.push({
          date: inv.invoiceDate,
          receiptNo: inv.invoiceNumber,
          name: inv.supplierName ?? entityName,
          mobile: inv.supplierMobile ?? entityMobile,
          type: invoiceLabel,
          invoiceAmount: sub,
          paymentAmount: Number(inv.paidAmountIqd ?? inv.paidAmount ?? 0),
          discount: discountIqd,
          oldBalance: 0,
          editHref: `/purchases/${inv.id}`,
        });
      });
      (supPayments ?? []).forEach((p) => {
        out.push({
          date: p.paymentDate,
          receiptNo: `پ-${p.id}`,
          name: p.supplierName || entityName,
          mobile: entityMobile,
          type: "پارەدان",
          invoiceAmount: 0,
          paymentAmount: Number(p.amountIqd ?? p.amount ?? 0),
          discount: 0,
          oldBalance: 0,
          editHref: `/supplier-payments`,
        });
      });
    }

    out.sort((a, b) => a.date.localeCompare(b.date) || a.receiptNo.localeCompare(b.receiptNo));

    // Walk the rows to compute running prior balance ("Old Balance" = balance BEFORE this row)
    let running = openingBalance;
    out.forEach((r) => {
      r.oldBalance = running;
      running += r.invoiceAmount - r.discount - r.paymentAmount;
    });

    return out;
  }, [
    enabled,
    kind,
    salesInvoices,
    custPayments,
    purchaseInvoices,
    supPayments,
    entityName,
    entityMobile,
    invoiceLabel,
    openingBalance,
  ]);

  const totalInvoices = rows.reduce((s, r) => s + r.invoiceAmount, 0);
  const totalPayments = rows.reduce((s, r) => s + r.paymentAmount, 0);
  const totalDiscounts = rows.reduce((s, r) => s + r.discount, 0);
  // Per spec: (Total Invoices + Old Balance) − (Total Payments + Total Discounts)
  const netTotalDebt = totalInvoices + openingBalance - totalPayments - totalDiscounts;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-[95vw] w-[1200px] p-0 gap-0 rounded-lg shadow-2xl border border-slate-300 bg-white overflow-hidden"
        dir="rtl"
      >
        {/* Win11-style title bar */}
        <DialogHeader className="px-5 py-3 bg-gradient-to-b from-slate-50 to-slate-100 border-b border-slate-200">
          <DialogTitle className="text-slate-800 text-base font-bold flex items-center gap-2">
            کەشف حساب
            <span className="text-slate-400 font-normal">·</span>
            <span className="text-slate-600 font-semibold">{entityName || "—"}</span>
            {entityMobile && (
              <span className="text-xs text-slate-500 font-normal" dir="ltr">{entityMobile}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        <div className="px-4 py-3 bg-slate-50">
          <div className="bg-white border border-slate-300 rounded-md overflow-hidden">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr className="text-slate-700">
                    <th className="border-b border-slate-300 px-2 py-2 font-bold w-[9%] text-right">ژ.وەسڵ</th>
                    <th className="border-b border-slate-300 px-2 py-2 font-bold w-[14%] text-right">ناو</th>
                    <th className="border-b border-slate-300 px-2 py-2 font-bold w-[10%] text-right">مۆبایل</th>
                    <th className="border-b border-slate-300 px-2 py-2 font-bold w-[9%] text-right">جۆری وەسڵ</th>
                    <th className="border-b border-slate-300 px-2 py-2 font-bold w-[9%] text-right">بەروار</th>
                    <th className="border-b border-slate-300 px-2 py-2 font-bold w-[10%] text-right">بڕی وەسڵ</th>
                    <th className="border-b border-slate-300 px-2 py-2 font-bold w-[10%] text-right">پارەدان</th>
                    <th className="border-b border-slate-300 px-2 py-2 font-bold w-[9%] text-right">داشکاندن</th>
                    <th className="border-b border-slate-300 px-2 py-2 font-bold w-[11%] text-right">قەرزی کۆن</th>
                    <th className="border-b border-slate-300 px-2 py-2 font-bold w-[7%] text-center">دەستکاری</th>
                  </tr>
                </thead>
                <tbody>
                  {!enabled && (
                    <tr><td colSpan={10} className="text-center text-slate-500 px-3 py-10">— کەسێک هەڵبژێرە —</td></tr>
                  )}
                  {enabled && rows.length === 0 && (
                    <tr><td colSpan={10} className="text-center text-slate-500 px-3 py-10">هیچ تۆمارێک نییە</td></tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50 even:bg-slate-50/40">
                      <td className="border-b border-slate-200 px-2 py-1.5 text-right font-semibold tabular-nums">{r.receiptNo}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-right">{r.name}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-right tabular-nums">{r.mobile || "—"}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-right">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${r.type === "پارەدان" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                          {r.type}
                        </span>
                      </td>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-right tabular-nums">{formatDate(r.date)}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-right tabular-nums">{r.invoiceAmount ? formatMoney(r.invoiceAmount) : "0"}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-right tabular-nums text-emerald-700 font-semibold">{r.paymentAmount ? formatMoney(r.paymentAmount) : "0"}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-right tabular-nums text-amber-700">{r.discount ? formatMoney(r.discount) : "0"}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-right tabular-nums">{formatMoney(r.oldBalance)}</td>
                      <td className="border-b border-slate-200 px-2 py-1.5 text-center">
                        {r.editHref ? (
                          <button
                            type="button"
                            onClick={() => { onClose(); navigate(r.editHref!); }}
                            title="دەستکاری"
                            className="inline-flex items-center justify-center h-7 w-7 rounded border border-slate-300 bg-white hover:bg-blue-50 hover:border-blue-400 text-blue-700 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer totals — fixed at bottom of grid */}
            <div className="border-t-2 border-slate-400 bg-slate-100 px-3 py-2 grid grid-cols-12 gap-2 text-[12px]">
              <div className="col-span-12 md:col-span-3 flex items-stretch border border-slate-300 bg-white rounded">
                <div className="flex-1 bg-blue-50 text-slate-800 font-bold flex items-center px-3 py-2">کۆی وەسڵەکان</div>
                <div className="w-36 px-3 py-2 text-left tabular-nums font-bold text-slate-900" dir="ltr">{formatMoney(totalInvoices)}</div>
              </div>
              <div className="col-span-12 md:col-span-3 flex items-stretch border border-slate-300 bg-white rounded">
                <div className="flex-1 bg-emerald-50 text-slate-800 font-bold flex items-center px-3 py-2">کۆی پارەدان</div>
                <div className="w-36 px-3 py-2 text-left tabular-nums font-bold text-emerald-700" dir="ltr">{formatMoney(totalPayments)}</div>
              </div>
              <div className="col-span-12 md:col-span-3 flex items-stretch border border-slate-300 bg-white rounded">
                <div className="flex-1 bg-amber-50 text-slate-800 font-bold flex items-center px-3 py-2">کۆی داشکاندن</div>
                <div className="w-36 px-3 py-2 text-left tabular-nums font-bold text-amber-700" dir="ltr">{formatMoney(totalDiscounts)}</div>
              </div>
              <div className="col-span-12 md:col-span-3 flex items-stretch border-2 border-rose-400 bg-rose-50 rounded shadow-inner">
                <div className="flex-1 text-rose-900 font-extrabold flex items-center px-3 py-2">کۆی قەرز</div>
                <div className={`w-36 px-3 py-2 text-left tabular-nums font-extrabold ${netTotalDebt > 0 ? "text-rose-700" : "text-emerald-700"}`} dir="ltr">{formatMoney(netTotalDebt)}</div>
              </div>
            </div>

            {/* Opening balance hint */}
            <div className="px-3 py-1.5 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
              <span>سەرەتای دەوام (Opening):</span>
              <span className="tabular-nums font-bold text-slate-700" dir="ltr">{formatMoney(openingBalance)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
