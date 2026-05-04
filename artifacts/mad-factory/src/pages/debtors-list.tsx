import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { Search, AlertCircle, Printer, FileSpreadsheet } from "lucide-react";
import { exportTableToExcel } from "@/lib/export";
import { PrintStyles } from "@/components/print-styles";

export default function DebtorsList() {
  const [search, setSearch] = useState("");
  const [onlyOwing, setOnlyOwing] = useState(true);

  const { data: customers, isLoading } = useListCustomers(
    { search: search || undefined },
    { query: { queryKey: getListCustomersQueryKey({ search: search || undefined }) } }
  );

  const filtered = useMemo(() => {
    const rows = customers ?? [];
    return onlyOwing ? rows.filter((c) => (c.totalDebt ?? 0) > 0) : rows;
  }, [customers, onlyOwing]);

  const totals = useMemo(() => filtered.reduce((acc, c) => ({
    opening: acc.opening + (c.openingBalance ?? 0),
    paid: acc.paid + (c.totalPaid ?? 0),
    debt: acc.debt + (c.totalDebt ?? 0),
  }), { opening: 0, paid: 0, debt: 0 }), [filtered]);

  const handleExport = () => {
    const head = `<tr><th>کۆد</th><th>ناوی کڕیار</th><th>مۆبایل</th><th>قەرزی کۆن</th><th>کۆی پارەدان</th><th>قەرزی ماوە</th></tr>`;
    const body = filtered.map((c) => `<tr><td>C-${c.id.toString().padStart(4, "0")}</td><td>${c.name}</td><td>${c.phone || "-"}</td><td>${(c.openingBalance ?? 0).toLocaleString()}</td><td>${(c.totalPaid ?? 0).toLocaleString()}</td><td>${(c.totalDebt ?? 0).toLocaleString()}</td></tr>`).join("");
    const foot = `<tr><th colspan="3">کۆی گشتی</th><th>${totals.opening.toLocaleString()}</th><th>${totals.paid.toLocaleString()}</th><th>${totals.debt.toLocaleString()}</th></tr>`;
    exportTableToExcel(`debtors-${new Date().toISOString().split("T")[0]}.xls`, `<h2>لیستی قەرزەکان</h2><table><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`);
  };

  return (
    <div className="space-y-4">
      <PrintStyles />
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <AlertCircle className="h-6 w-6 text-red-600" />لیستی قەرزەکان
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />چاپکردن</Button>
          <Button onClick={handleExport} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><FileSpreadsheet className="h-4 w-4" />ئێکسڵ</Button>
        </div>
      </div>

      <Card className="print-area">
        <CardHeader className="pb-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="گەڕان بە ناو یان مۆبایل..." className="pl-3 pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={onlyOwing} onChange={(e) => setOnlyOwing(e.target.checked)} className="h-4 w-4" />
              تەنها قەرزدارەکان
            </label>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="hidden print:block text-center py-3 border-b">
            <div className="text-xl font-bold">کارگەی خشتی ماد — لیستی قەرزەکان</div>
            <div className="text-xs text-slate-500 mt-1" dir="ltr">{new Date().toLocaleDateString("en-GB")}</div>
          </div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold w-20">کۆد</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">ناوی کڕیار</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">مۆبایل</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">قەرزی کۆن</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">کۆی پارەدان</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">قەرزی ماوە</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ قەرزدارێک نییە</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-500">C-{c.id.toString().padStart(4, "0")}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2">
                    <Link href={`/customers/${c.id}`} className="font-semibold text-primary hover:underline print:no-underline print:text-slate-900">{c.name}</Link>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center" dir="ltr">{c.phone || "—"}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums" dir="ltr">{(c.openingBalance ?? 0).toLocaleString()}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{(c.totalPaid ?? 0).toLocaleString()}</td>
                  <td className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold ${(c.totalDebt ?? 0) > 0 ? "text-red-700" : "text-slate-500"}`} dir="ltr">{(c.totalDebt ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <td colSpan={3} className="border border-slate-300 dark:border-slate-600 px-3 py-2">کۆی گشتی ({filtered.length} کڕیار)</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(totals.opening)}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{formatMoney(totals.paid)}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-red-700" dir="ltr">{formatMoney(totals.debt)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
