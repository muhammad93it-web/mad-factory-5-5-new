import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListSalesInvoices, getListSalesInvoicesQueryKey, useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney, formatDate } from "@/lib/format";
import { exportTableToExcel } from "@/lib/export";
import { PrintStyles } from "@/components/print-styles";
import { Search, Plus, ShoppingCart, Printer, FileSpreadsheet, X, FileText } from "lucide-react";

export default function Sales() {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [customerId, setCustomerId] = useState<string>("");
  const [, navigate] = useLocation();

  const params = { search: search || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined, customerId: customerId ? Number(customerId) : undefined };
  const { data: invoices, isLoading } = useListSalesInvoices(params, { query: { queryKey: getListSalesInvoicesQueryKey(params) } });
  const { data: customers } = useListCustomers({}, { query: { queryKey: getListCustomersQueryKey({}) } });

  const totals = (invoices ?? []).reduce((acc, i) => ({ total: acc.total + Number(i.total), paid: acc.paid + Number(i.paidAmount), debt: acc.debt + Number(i.remainingDebt) }), { total: 0, paid: 0, debt: 0 });

  const exportExcel = () => {
    const rows = (invoices ?? []).map((i) => `<tr><td>${i.invoiceNumber}</td><td>${i.invoiceDate}</td><td>${i.customerName}</td><td>${Number(i.total).toLocaleString("en-US")}</td><td>${Number(i.paidAmount).toLocaleString("en-US")}</td><td>${Number(i.remainingDebt).toLocaleString("en-US")}</td></tr>`).join("");
    const html = `<h2>پسووڵەکانی فرۆشتن</h2><table><thead><tr><th>ژمارە</th><th>بەروار</th><th>کڕیار</th><th>کۆی گشتی</th><th>دراو</th><th>قەرز</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="3">کۆی گشتی</th><th>${totals.total.toLocaleString("en-US")}</th><th>${totals.paid.toLocaleString("en-US")}</th><th>${totals.debt.toLocaleString("en-US")}</th></tr></tfoot></table>`;
    exportTableToExcel(`sales-${fromDate || "all"}-${toDate || "all"}.xls`, html);
  };

  return (
    <div className="space-y-6">
      <PrintStyles />
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-primary" />پسووڵەکانی فرۆشتن
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />چاپ</Button>
          <Button variant="outline" onClick={exportExcel} className="gap-2"><FileSpreadsheet className="h-4 w-4" />ئێگزڵ</Button>
          <Link href="/sales/consolidated"><Button variant="outline" className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"><FileText className="h-4 w-4" />پسووڵەی یەکگرتوو</Button></Link>
          <Button
            variant="outline"
            disabled={!customerId}
            onClick={() => customerId && navigate(`/customer-statement?customerId=${customerId}&general=1`)}
            className="gap-2 border-emerald-400 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
            title={customerId ? "کەشف حسابی ئەم کڕیارە" : "سەرەتا کڕیارێک هەڵبژێرە"}
          >
            <FileText className="h-4 w-4" />کەشف حسابی کڕیار
          </Button>
          <Link href="/sales/new"><Button className="bg-primary hover:bg-primary/90 text-white gap-2"><Plus className="h-4 w-4" />پسووڵەی نوێ</Button></Link>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="گەڕان بە ژمارەی پسووڵە یان کڕیار..." className="pl-3 pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <Select value={customerId || "all"} onValueChange={(v) => setCustomerId(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="هەموو کڕیارەکان" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">هەموو کڕیارەکان</SelectItem>
                {customers?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {(fromDate || toDate || customerId || search) && (
            <button onClick={() => { setFromDate(""); setToDate(""); setCustomerId(""); setSearch(""); }} className="self-end text-xs text-primary hover:underline flex items-center gap-1 mt-2">
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
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">ناوی کڕیار</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">کۆی گشتی</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">بڕی دراو</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">ماوە (قەرز)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : !invoices?.length ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ پسووڵەیەک نەدۆزرایەوە</td></tr>
              ) : invoices.map((inv, i) => (
                <tr key={inv.id} onClick={() => navigate(`/sales/${inv.id}`)} className={`cursor-pointer transition-colors hover:bg-primary/5 ${i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}`}>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono font-semibold text-primary">{inv.invoiceNumber}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center tabular-nums" dir="ltr">{formatDate(inv.invoiceDate)}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-semibold">{inv.customerName}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(inv.total)}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-emerald-600" dir="ltr">{formatMoney(inv.paidAmount)}</td>
                  <td className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold ${inv.remainingDebt > 0 ? "text-destructive" : "text-slate-400"}`} dir="ltr">{formatMoney(inv.remainingDebt)}</td>
                </tr>
              ))}
            </tbody>
            {(invoices?.length ?? 0) > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <td colSpan={3} className="border border-slate-300 dark:border-slate-600 px-3 py-2">کۆی گشتی ({invoices?.length} پسووڵە)</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(totals.total)}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-emerald-600" dir="ltr">{formatMoney(totals.paid)}</td>
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
