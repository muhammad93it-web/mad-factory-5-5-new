import { useState } from "react";
import { useListTreasuryMovements, getListTreasuryMovementsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { exportTableToExcel } from "@/lib/export";
import { PrintStyles } from "@/components/print-styles";
import { Banknote, Printer, FileSpreadsheet, ArrowDownCircle, ArrowUpCircle, X } from "lucide-react";

export default function TreasuryMovements() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const params = { fromDate: fromDate || undefined, toDate: toDate || undefined };
  const { data: rows, isLoading } = useListTreasuryMovements(params, { query: { queryKey: getListTreasuryMovementsQueryKey(params) } });

  const totals = (rows ?? []).reduce((acc, r) => {
    if (r.direction === "in") acc.in += Number(r.amount);
    else acc.out += Number(r.amount);
    return acc;
  }, { in: 0, out: 0 });
  const net = totals.in - totals.out;

  const exportExcel = () => {
    const body = (rows ?? []).map((r) => `<tr><td>${r.date}</td><td>${r.type}</td><td>${r.description}</td><td>${r.direction === "in" ? Number(r.amount).toLocaleString("en-US") : ""}</td><td>${r.direction === "out" ? Number(r.amount).toLocaleString("en-US") : ""}</td></tr>`).join("");
    const html = `<h2>جووڵەی خەزینە</h2><table><thead><tr><th>بەروار</th><th>جۆر</th><th>وەسف</th><th>هاتنە ژوور</th><th>چوونە دەرەوە</th></tr></thead><tbody>${body}</tbody><tfoot><tr><th colspan="3">کۆی هاتنە ژوور</th><th>${totals.in.toLocaleString("en-US")}</th><th></th></tr><tr><th colspan="3">کۆی چوونە دەرەوە</th><th></th><th>${totals.out.toLocaleString("en-US")}</th></tr><tr><th colspan="3">پاشماوە</th><th colspan="2">${net.toLocaleString("en-US")}</th></tr></tfoot></table>`;
    exportTableToExcel(`treasury-${fromDate || "all"}-${toDate || "all"}.xls`, html);
  };

  return (
    <div className="space-y-6">
      <PrintStyles />
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Banknote className="h-6 w-6 text-primary" />جووڵەی خەزینە
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />چاپ</Button>
          <Button variant="outline" onClick={exportExcel} className="gap-2"><FileSpreadsheet className="h-4 w-4" />ئێگزڵ</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
          <div className="flex items-center gap-3">
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="max-w-xs" />
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="max-w-xs" />
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(""); setToDate(""); }} className="text-xs text-primary hover:underline flex items-center gap-1">
                <X className="h-3 w-3" />سڕینەوە
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-3 gap-4 p-4 border-b">
            <div className="rounded-lg p-3 bg-emerald-50 border border-emerald-200">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><ArrowDownCircle className="h-4 w-4 text-emerald-600" />هاتنە ژوور</div>
              <div className="text-xl font-bold text-emerald-700" dir="ltr">{formatMoney(totals.in)}</div>
            </div>
            <div className="rounded-lg p-3 bg-rose-50 border border-rose-200">
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><ArrowUpCircle className="h-4 w-4 text-rose-600" />چوونە دەرەوە</div>
              <div className="text-xl font-bold text-rose-700" dir="ltr">{formatMoney(totals.out)}</div>
            </div>
            <div className="rounded-lg p-3 bg-blue-50 border border-blue-200">
              <div className="text-xs text-slate-500 mb-1">پاشماوە</div>
              <div className={`text-xl font-bold ${net >= 0 ? "text-blue-700" : "text-rose-700"}`} dir="ltr">{formatMoney(net)}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">بەروار</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">جۆر</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">وەسف</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">هاتنە ژوور</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">چوونە دەرەوە</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
                ) : !rows?.length ? (
                  <tr><td colSpan={5} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ جووڵەیەک نەدۆزرایەوە</td></tr>
                ) : rows.map((r, i) => (
                  <tr key={`${r.sourceModule}-${r.sourceId}-${i}`} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center tabular-nums" dir="ltr">{r.date}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.direction === "in" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{r.type}</span>
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2">{r.description}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-emerald-700 font-medium" dir="ltr">{r.direction === "in" ? formatMoney(r.amount) : ""}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-rose-700 font-medium" dir="ltr">{r.direction === "out" ? formatMoney(r.amount) : ""}</td>
                  </tr>
                ))}
              </tbody>
              {(rows?.length ?? 0) > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                    <td colSpan={3} className="border border-slate-300 dark:border-slate-600 px-3 py-2">کۆی هاتنە ژوور</td>
                    <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{formatMoney(totals.in)}</td>
                    <td className="border border-slate-300 dark:border-slate-600 px-3 py-2"></td>
                  </tr>
                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                    <td colSpan={3} className="border border-slate-300 dark:border-slate-600 px-3 py-2">کۆی چوونە دەرەوە</td>
                    <td className="border border-slate-300 dark:border-slate-600 px-3 py-2"></td>
                    <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-rose-700" dir="ltr">{formatMoney(totals.out)}</td>
                  </tr>
                  <tr className="bg-primary/10 dark:bg-primary/20 font-bold">
                    <td colSpan={3} className="border border-slate-300 dark:border-slate-600 px-3 py-2">پاشماوە</td>
                    <td colSpan={2} className={`border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums ${net >= 0 ? "text-emerald-700" : "text-rose-700"}`} dir="ltr">{formatMoney(net)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
