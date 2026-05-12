import { useRoute, useLocation } from "wouter";
import { useGetPurchaseInvoice, getGetPurchaseInvoiceQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate } from "@/lib/format";
import { ArrowRight, Printer, FileSpreadsheet, Truck, Calendar, Building2 } from "lucide-react";
import { exportTableToExcel, buildInvoiceTableHtml } from "@/lib/export";
import { PrintStyles } from "@/components/print-styles";

export default function PurchaseDetail() {
  const [, params] = useRoute("/purchases/:id");
  const [, navigate] = useLocation();
  const id = params?.id ? Number(params.id) : 0;

  const { data: invoice, isLoading } = useGetPurchaseInvoice(id, {
    query: { enabled: !!id, queryKey: getGetPurchaseInvoiceQueryKey(id) },
  });

  if (isLoading) return <div className="p-8 text-center text-slate-500">بەڕێکردن...</div>;
  if (!invoice) return <div className="p-8 text-center text-destructive">پسووڵە نەدۆزرایەوە</div>;

  const isUSD = invoice.currency === "USD";
  const c = (n: number) => `${n.toLocaleString()} ${isUSD ? '$' : 'د.ع'}`;

  const handleExport = () => {
    const html = buildInvoiceTableHtml({
      title: `پسووڵەی کڕین — ${invoice.invoiceNumber}`,
      meta: [
        ["ژمارەی پسووڵە", invoice.invoiceNumber],
        ["بەروار", formatDate(invoice.invoiceDate)],
        ["ناوی دابینکار", invoice.supplierName],
        ["دراو", invoice.currency],
        ["نرخی دۆلار", invoice.exchangeRateValue ? String(invoice.exchangeRateValue) : "-"],
        ["تێبینی", invoice.notes || "-"],
      ],
      itemHeaders: ["#", "ناوی شت", "بڕ", "پاڵەت", `نرخی یەک (${invoice.currency})`, `کۆ (${invoice.currency})`],
      itemRows: invoice.items.map((it, i) => [
        i + 1,
        it.materialName,
        it.quantity,
        it.palletCount ?? "-",
        it.unitPrice.toLocaleString(),
        it.total.toLocaleString(),
      ]),
      totals: [
        [`کۆی گشتی (${invoice.currency})`, c(invoice.subtotal)],
        ["داشکاندن", c(invoice.discount)],
        [`کۆی پارەدراو (${invoice.currency})`, c(invoice.total)],
        ["کۆی گشتی بە دینار", `${invoice.totalIqd.toLocaleString()} د.ع`],
        ["دراوە", c(invoice.paidAmount)],
        ["قەرزی ماوە بە دینار", `${invoice.remainingDebtIqd.toLocaleString()} د.ع`],
      ],
    });
    exportTableToExcel(`${invoice.invoiceNumber}.xls`, html);
  };

  return (
    <div className="space-y-5">
      <PrintStyles />

      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          پسووڵەی کڕین
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/purchases")} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            گەڕانەوە
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />
            چاپکردن
          </Button>
          <Button onClick={handleExport} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileSpreadsheet className="h-4 w-4" />
            هەناردەکردن بۆ ئێکسڵ
          </Button>
        </div>
      </div>

      <Card className="print-area shadow-sm border-slate-200">
        <CardContent className="p-8">
          <div className="flex items-start justify-between pb-6 border-b-2 border-primary">
            <div>
              <h2 className="text-2xl font-bold text-primary">کارگەی خشتی ماد</h2>
              <p className="text-sm text-slate-500 mt-1">پسووڵەی کڕین / Purchase Invoice</p>
            </div>
            <div className="text-left">
              <div className="text-xs text-slate-500 mb-1">ژمارەی پسووڵە</div>
              <div className="text-2xl font-bold font-mono text-primary" dir="ltr">{invoice.invoiceNumber}</div>
              <div className="text-xs text-slate-500 mt-2 flex items-center justify-end gap-1.5">
                <Calendar className="h-3 w-3" />
                {formatDate(invoice.invoiceDate)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 py-6 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                ناوی دابینکار
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-bold text-slate-900">{invoice.supplierName}</div>
                <button
                  type="button"
                  onClick={() => navigate(`/supplier-statement?supplierId=${invoice.supplierId}&general=1`)}
                  className="print:hidden inline-flex items-center gap-1 px-2 py-1 rounded border border-blue-400 text-blue-700 hover:bg-blue-50 text-[11px] font-bold"
                  title="کەشف حسابی ئەم دابینکارە"
                >
                  کەشف حساب
                </button>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">دراو:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${isUSD ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                  {invoice.currency}
                </span>
              </div>
              {isUSD && invoice.exchangeRateValue && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-xs">نرخی دۆلار:</span>
                  <span className="font-medium tabular-nums" dir="ltr">1 USD = {Number(invoice.exchangeRateValue).toLocaleString()} IQD</span>
                </div>
              )}
            </div>
          </div>

          <div className="py-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs">
                  <th className="border border-slate-200 px-3 py-2 text-right w-10">#</th>
                  <th className="border border-slate-200 px-3 py-2 text-right">ناوی شت</th>
                  <th className="border border-slate-200 px-3 py-2 text-center w-20">بڕ</th>
                  <th className="border border-slate-200 px-3 py-2 text-center w-20">پاڵەت</th>
                  <th className="border border-slate-200 px-3 py-2 text-left w-32">نرخی یەک ({invoice.currency})</th>
                  <th className="border border-slate-200 px-3 py-2 text-left w-36">کۆ ({invoice.currency})</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.length === 0 ? (
                  <tr><td colSpan={6} className="border border-slate-200 px-3 py-6 text-center text-slate-400">هیچ بڕگەیەک نییە</td></tr>
                ) : invoice.items.map((it, i) => (
                  <tr key={it.id}>
                    <td className="border border-slate-200 px-3 py-2 text-center text-slate-500">{i + 1}</td>
                    <td className="border border-slate-200 px-3 py-2 font-medium">{it.materialName}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center tabular-nums">{it.quantity.toLocaleString()}</td>
                    <td className="border border-slate-200 px-3 py-2 text-center text-slate-500">{it.palletCount ?? "—"}</td>
                    <td className="border border-slate-200 px-3 py-2 text-left tabular-nums" dir="ltr">{it.unitPrice.toLocaleString()}</td>
                    <td className="border border-slate-200 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{it.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200">
            <div>
              {invoice.notes && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">تێبینی</div>
                  <div className="text-sm whitespace-pre-wrap bg-slate-50 rounded p-3 border border-slate-100">
                    {invoice.notes}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-slate-500">کۆی گشتی ({invoice.currency}):</span>
                <span className="font-medium tabular-nums">{c(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-slate-500">داشکاندن:</span>
                <span className="font-medium tabular-nums text-red-600">- {c(invoice.discount)}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-slate-300 font-bold">
                <span>کۆی پارەدراو:</span>
                <span className="text-lg tabular-nums">{c(invoice.total)}</span>
              </div>
              {isUSD && (
                <div className="flex justify-between text-xs py-1 text-slate-500">
                  <span>بە دینار:</span>
                  <span className="tabular-nums">{formatMoney(invoice.totalIqd)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-slate-500">دراوە:</span>
                <span className="font-medium tabular-nums text-emerald-600">{c(invoice.paidAmount)}</span>
              </div>
              <div className={`flex justify-between py-2 px-3 rounded ${Number(invoice.remainingDebtIqd) > 0 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'} font-bold`}>
                <span>قەرزی ماوە:</span>
                <span className={`text-lg tabular-nums ${Number(invoice.remainingDebtIqd) > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                  {formatMoney(invoice.remainingDebtIqd)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mt-12 pt-8 text-sm">
            <div className="text-center">
              <div className="border-t border-slate-300 pt-2 text-slate-500">واژۆی وەرگر</div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-300 pt-2 text-slate-500">واژۆی دابینکار</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
