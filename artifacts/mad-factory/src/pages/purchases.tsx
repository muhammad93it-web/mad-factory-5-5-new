import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListPurchaseInvoices, getListPurchaseInvoicesQueryKey, useListSuppliers, getListSuppliersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { exportTableToExcel } from "@/lib/export";
import { PrintStyles } from "@/components/print-styles";
import { Plus, Truck, Printer, FileSpreadsheet, X, FileText } from "lucide-react";

export default function Purchases() {
  const [, navigate] = useLocation();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [currency, setCurrency] = useState("");

  const params = { fromDate: fromDate || undefined, toDate: toDate || undefined, supplierId: supplierId ? Number(supplierId) : undefined, currency: currency || undefined };
  const { data: invoices, isLoading } = useListPurchaseInvoices(params, { query: { queryKey: getListPurchaseInvoicesQueryKey(params) } });
  const { data: suppliers } = useListSuppliers({}, { query: { queryKey: getListSuppliersQueryKey({}) } });

  const totals = (invoices ?? []).reduce((acc, i) => ({ total: acc.total + Number(i.totalIqd), debt: acc.debt + Number(i.remainingDebtIqd) }), { total: 0, debt: 0 });

  const exportExcel = () => {
    const rows = (invoices ?? []).map((i) => `<tr><td>${i.invoiceNumber}</td><td>${i.invoiceDate}</td><td>${i.supplierName}</td><td>${i.currency}</td><td>${Number(i.totalIqd).toLocaleString("en-US")}</td><td>${Number(i.remainingDebtIqd).toLocaleString("en-US")}</td></tr>`).join("");
    const html = `<h2>پسووڵەکانی کڕین</h2><table><thead><tr><th>ژمارە</th><th>بەروار</th><th>دابینکار</th><th>دراو</th><th>کۆ (د.ع)</th><th>قەرز</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="4">کۆی گشتی</th><th>${totals.total.toLocaleString("en-US")}</th><th>${totals.debt.toLocaleString("en-US")}</th></tr></tfoot></table>`;
    exportTableToExcel(`purchases-${fromDate || "all"}-${toDate || "all"}.xls`, html);
  };

  return (
    <div className="space-y-6">
      <PrintStyles />
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />پسووڵەکانی کڕین
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />چاپ</Button>
          <Button variant="outline" onClick={exportExcel} className="gap-2"><FileSpreadsheet className="h-4 w-4" />ئێگزڵ</Button>
          <Link href="/purchases/consolidated"><Button variant="outline" className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"><FileText className="h-4 w-4" />پسووڵەی یەکگرتوو</Button></Link>
          <Link href="/purchases/new"><Button className="gap-2"><Plus className="h-4 w-4" />پسووڵەی نوێ</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <Select value={supplierId || "all"} onValueChange={(v) => setSupplierId(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="هەموو دابینکارەکان" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">هەموو دابینکارەکان</SelectItem>
                {suppliers?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={currency || "all"} onValueChange={(v) => setCurrency(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="هەموو دراو" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">هەموو دراو</SelectItem>
                <SelectItem value="IQD">دیناری عێراقی</SelectItem>
                <SelectItem value="USD">دۆلاری ئەمریکی</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(fromDate || toDate || supplierId || currency) && (
            <button onClick={() => { setFromDate(""); setToDate(""); setSupplierId(""); setCurrency(""); }} className="self-end text-xs text-primary hover:underline flex items-center gap-1 mt-2">
              <X className="h-3 w-3" />سڕینەوەی پاڵاوتنەکان
            </button>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">ژمارەی پسووڵە</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">بەروار</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">دابینکار</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">دراو</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">کۆی گشتی (د.ع)</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">قەرزی ماوە</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : !invoices?.length ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ پسووڵەیەک نەدۆزرایەوە</td></tr>
              ) : invoices.map((inv, i) => (
                <tr key={inv.id} onClick={() => navigate(`/purchases/${inv.id}`)} className={`cursor-pointer transition-colors hover:bg-primary/5 ${i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}`}>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono font-semibold text-primary">{inv.invoiceNumber}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center tabular-nums" dir="ltr">{inv.invoiceDate}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-semibold">{inv.supplierName}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${inv.currency === "USD" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}`}>{inv.currency}</span>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(inv.totalIqd)}</td>
                  <td className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold ${Number(inv.remainingDebtIqd) > 0 ? "text-destructive" : "text-slate-400"}`} dir="ltr">{formatMoney(inv.remainingDebtIqd)}</td>
                </tr>
              ))}
            </tbody>
            {(invoices?.length ?? 0) > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <td colSpan={4} className="border border-slate-300 dark:border-slate-600 px-3 py-2">کۆی گشتی ({invoices?.length} پسووڵە)</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(totals.total)}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-destructive" dir="ltr">{formatMoney(totals.debt)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
