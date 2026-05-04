import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useListSalesInvoices, getListSalesInvoicesQueryKey } from "@workspace/api-client-react";
import { formatMoney, formatDate } from "@/lib/format";
import { BarChart3, Printer, FileSpreadsheet, Search } from "lucide-react";
import { exportTableToExcel } from "@/lib/export";
import { PrintStyles } from "@/components/print-styles";

type GroupBy = "none" | "date" | "customer";

export default function SalesReport() {
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(today.getDate() - 30);
  const [fromDate, setFromDate] = useState(monthAgo.toISOString().split("T")[0]);
  const [toDate, setToDate] = useState(today.toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [applied, setApplied] = useState({ from: monthAgo.toISOString().split("T")[0], to: today.toISOString().split("T")[0], search: "" });

  const queryParams = { fromDate: applied.from || undefined, toDate: applied.to || undefined, search: applied.search || undefined };
  const { data: invoices, isLoading } = useListSalesInvoices(queryParams, { query: { queryKey: getListSalesInvoicesQueryKey(queryParams) } });
  const rows = invoices ?? [];

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    subtotal: acc.subtotal + (r.subtotal ?? 0), discount: acc.discount + (r.discount ?? 0),
    total: acc.total + (r.total ?? 0), paid: acc.paid + (r.paidAmount ?? 0), remaining: acc.remaining + (r.remainingDebt ?? 0),
  }), { subtotal: 0, discount: 0, total: 0, paid: 0, remaining: 0 }), [rows]);

  const grouped = useMemo(() => {
    if (groupBy === "none") return null;
    const map = new Map<string, { key: string; label: string; count: number; total: number; paid: number; remaining: number }>();
    for (const r of rows) {
      const key = groupBy === "date" ? r.invoiceDate : `${r.customerId}|${r.customerName}`;
      const label = groupBy === "date" ? formatDate(r.invoiceDate) : r.customerName;
      const cur = map.get(key) ?? { key, label, count: 0, total: 0, paid: 0, remaining: 0 };
      cur.count += 1; cur.total += r.total ?? 0; cur.paid += r.paidAmount ?? 0; cur.remaining += r.remainingDebt ?? 0;
      map.set(key, cur);
    }
    const arr = Array.from(map.values());
    if (groupBy === "date") arr.sort((a, b) => (a.key < b.key ? 1 : -1));
    else arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [rows, groupBy]);

  const handleExport = () => {
    let body = "", head = "", foot = "";
    if (groupBy === "none") {
      head = `<tr><th>ژ</th><th>ژمارەی وەسڵ</th><th>بەروار</th><th>کڕیار</th><th>کۆ</th><th>پارەدان</th><th>قەرز ماوە</th></tr>`;
      body = rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.invoiceNumber}</td><td>${r.invoiceDate}</td><td>${r.customerName}</td><td>${(r.total ?? 0).toLocaleString()}</td><td>${(r.paidAmount ?? 0).toLocaleString()}</td><td>${(r.remainingDebt ?? 0).toLocaleString()}</td></tr>`).join("");
      foot = `<tr><th colspan="4">کۆی گشتی</th><th>${totals.total.toLocaleString()}</th><th>${totals.paid.toLocaleString()}</th><th>${totals.remaining.toLocaleString()}</th></tr>`;
    } else {
      const label = groupBy === "date" ? "بەروار" : "کڕیار";
      head = `<tr><th>${label}</th><th>ژمارەی وەسڵ</th><th>کۆ</th><th>پارەدان</th><th>قەرز ماوە</th></tr>`;
      body = (grouped ?? []).map((g) => `<tr><td>${g.label}</td><td>${g.count}</td><td>${g.total.toLocaleString()}</td><td>${g.paid.toLocaleString()}</td><td>${g.remaining.toLocaleString()}</td></tr>`).join("");
      foot = `<tr><th colspan="2">کۆی گشتی</th><th>${totals.total.toLocaleString()}</th><th>${totals.paid.toLocaleString()}</th><th>${totals.remaining.toLocaleString()}</th></tr>`;
    }
    exportTableToExcel(`sales-report-${applied.from}_${applied.to}.xls`, `<h2>ڕاپۆرتی فرۆشتن (${applied.from} → ${applied.to})</h2><table><thead>${head}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`);
  };

  return (
    <div className="space-y-4">
      <PrintStyles />
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" />ڕاپۆرتی فرۆشتن</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />چاپکردن</Button>
          <Button onClick={handleExport} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><FileSpreadsheet className="h-4 w-4" />ئێکسڵ</Button>
        </div>
      </div>

      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div><Label className="text-xs">لە بەرواری</Label><Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1" /></div>
            <div><Label className="text-xs">تا بەرواری</Label><Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1" /></div>
            <div>
              <Label className="text-xs">گەڕان</Label>
              <div className="relative mt-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="ژمارەی وەسڵ، کڕیار..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-3 pr-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs">گرووپکردن بەپێی</Label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="w-full border rounded px-3 py-2 mt-1 bg-white dark:bg-slate-900 text-sm h-10">
                <option value="none">بێ گرووپ — هەموو وەسڵەکان</option>
                <option value="date">بەپێی بەروار</option>
                <option value="customer">بەپێی کڕیار</option>
              </select>
            </div>
            <div className="flex items-end"><Button onClick={() => setApplied({ from: fromDate, to: toDate, search })} className="w-full">دووپاتکردنەوە</Button></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4">
        <Card><CardContent className="pt-4"><div className="text-xs text-slate-500">ژمارەی وەسڵ</div><div className="text-xl font-bold mt-1">{rows.length.toLocaleString()}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-slate-500">کۆی فرۆشتن</div><div className="text-xl font-bold mt-1 text-emerald-700">{formatMoney(totals.total)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-slate-500">کۆی پارەدان</div><div className="text-xl font-bold mt-1 text-blue-700">{formatMoney(totals.paid)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-slate-500">قەرزی ماوە</div><div className="text-xl font-bold mt-1 text-red-700">{formatMoney(totals.remaining)}</div></CardContent></Card>
      </div>

      <Card className="print-area">
        <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/50">
          <div className="hidden print:block text-center">
            <div className="text-xl font-bold">کارگەی خشتی ماد — ڕاپۆرتی فرۆشتن</div>
            <div className="text-xs text-slate-500 mt-1" dir="ltr">{applied.from} → {applied.to}</div>
          </div>
          <div className="text-sm font-bold print:hidden">
            {groupBy === "none" ? "هەموو وەسڵەکان" : groupBy === "date" ? "گرووپ بەپێی بەروار" : "گرووپ بەپێی کڕیار"}
            <span className="text-slate-500 font-normal me-2">({applied.from} → {applied.to})</span>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">بەڕێکردن...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-slate-500">هیچ وەسڵێک لەم ماوەیەدا نییە</div>
          ) : groupBy === "none" ? (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold w-10">ژ</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">ژمارەی وەسڵ</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">بەروار</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">کڕیار</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">کۆ (د.ع)</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">پارەدان</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">قەرز ماوە</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center text-slate-400">{i + 1}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2">
                      <Link href={`/sales/${r.id}`} className="font-mono text-primary hover:underline print:no-underline">{r.invoiceNumber}</Link>
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center tabular-nums" dir="ltr">{formatDate(r.invoiceDate)}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-medium">{r.customerName}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{(r.total ?? 0).toLocaleString()}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{(r.paidAmount ?? 0).toLocaleString()}</td>
                    <td className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums ${(r.remainingDebt ?? 0) > 0 ? "text-red-700 font-bold" : "text-slate-500"}`} dir="ltr">{(r.remainingDebt ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <td colSpan={4} className="border border-slate-300 dark:border-slate-600 px-3 py-2">کۆی گشتی ({rows.length})</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(totals.total)}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{formatMoney(totals.paid)}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-red-700" dir="ltr">{formatMoney(totals.remaining)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">{groupBy === "date" ? "بەروار" : "کڕیار"}</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">ژمارەی وەسڵ</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">کۆ (د.ع)</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">پارەدان</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">قەرز ماوە</th>
                </tr>
              </thead>
              <tbody>
                {(grouped ?? []).map((g, i) => (
                  <tr key={g.key} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-medium" dir={groupBy === "date" ? "ltr" : undefined}>{g.label}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center tabular-nums">{g.count}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{g.total.toLocaleString()}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{g.paid.toLocaleString()}</td>
                    <td className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums ${g.remaining > 0 ? "text-red-700 font-bold" : "text-slate-500"}`} dir="ltr">{g.remaining.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2">کۆی گشتی</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-center tabular-nums">{rows.length}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(totals.total)}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{formatMoney(totals.paid)}</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-red-700" dir="ltr">{formatMoney(totals.remaining)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
