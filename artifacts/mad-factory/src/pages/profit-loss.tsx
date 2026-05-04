import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useGetProfitLossReport } from "@workspace/api-client-react";
import { FileText, TrendingUp, TrendingDown, Users, Printer, FileSpreadsheet, Equal, Minus } from "lucide-react";
import { exportTableToExcel } from "@/lib/export";
import { PrintStyles } from "@/components/print-styles";

export default function ProfitLoss() {
  const today = new Date();
  const [fromDate, setFromDate] = useState(`${today.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(today.toISOString().split("T")[0]);
  const [applied, setApplied] = useState({ from: fromDate, to: toDate });

  const { data: report, isLoading } = useGetProfitLossReport(
    { fromDate: applied.from, toDate: applied.to },
    { query: { queryKey: ["profitLoss", applied.from, applied.to] } }
  );

  // Derived values for the explicit equation
  const totalRevenue = report?.totalRevenue ?? 0;
  const otherIncome = report?.otherIncome ?? 0;
  const grossIncome = totalRevenue + otherIncome;

  const productionCost = report?.totalCost ?? 0; // COGS — quantity × material.purchase_price
  const totalPurchases = report?.totalPurchases ?? 0; // Inventory acquired (informational)
  const cogsMissingCount = report?.cogsMissingCount ?? 0; // sales items with no material → cost not counted
  const cogsMissingRevenue = report?.cogsMissingRevenue ?? 0;
  const totalExpenses = report?.totalExpenses ?? 0;
  const totalPayroll = report?.totalPayroll ?? 0;
  const totalCostsAndExpenses = productionCost + totalExpenses + totalPayroll;

  const netProfit = grossIncome - totalCostsAndExpenses;
  const isProfit = netProfit >= 0;

  const handleExport = () => {
    if (!report) return;
    const summaryRows = [
      ["داهاتی فرۆشتن", totalRevenue],
      ["داهاتی تر", otherIncome],
      ["کۆی داهات", grossIncome],
      ["نرخی بەرهەمهێنانی فرۆشراو (COGS)", productionCost],
      ["خەرجیە گشتیەکان", totalExpenses],
      ["مووچەی کارمەندان", totalPayroll],
      ["کۆی لێچوون و خەرجی", totalCostsAndExpenses],
      [isProfit ? "قازانجی سافی" : "زیانی سافی", Math.abs(netProfit)],
      ["—", 0],
      ["پسووڵەی کڕینی تۆمارکراو (زانیاری)", totalPurchases],
    ]
      .map(([k, v]) => `<tr><th>${k}</th><td>${(v ?? 0).toLocaleString()}</td></tr>`)
      .join("");
    const beforeRows = (report.profitByShareholdersBreakdown ?? [])
      .map((s) => {
        const totalProfitBeforeSalary = netProfit + totalPayroll;
        const share = (totalProfitBeforeSalary * (s.sharePercentage ?? 0)) / 100;
        return `<tr><td>${s.shareholderName}</td><td>${s.sharePercentage}%</td><td>${share.toLocaleString()}</td></tr>`;
      })
      .join("");
    const afterRows = (report.profitByShareholdersBreakdown ?? [])
      .map((s) => `<tr><td>${s.shareholderName}</td><td>${s.sharePercentage}%</td><td>${(s.profitShare ?? 0).toLocaleString()}</td></tr>`)
      .join("");
    const html = `
      <h2>ڕاپۆرتی قازانج و زیان (${applied.from} → ${applied.to})</h2>
      <h3>پوختە</h3><table>${summaryRows}</table>
      <h3>دابەشکردن — پێش لێبڕینی مووچە (کۆ: ${(netProfit + totalPayroll).toLocaleString()})</h3>
      <table><thead><tr><th>شریک</th><th>ڕێژە</th><th>بەش</th></tr></thead><tbody>${beforeRows}</tbody></table>
      <h3>دابەشکردن — دوای لێبڕینی مووچە (کۆ: ${netProfit.toLocaleString()})</h3>
      <table><thead><tr><th>شریک</th><th>ڕێژە</th><th>بەش</th></tr></thead><tbody>${afterRows}</tbody></table>
    `;
    exportTableToExcel(`profit-loss-${applied.from}_${applied.to}.xls`, html);
  };

  return (
    <div className="space-y-6">
      <PrintStyles />
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          ڕاپۆرتی قازانج و زیان
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-sm">لە:</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">تا:</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
          </div>
          <Button onClick={() => setApplied({ from: fromDate, to: toDate })}>پیشاندان</Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> چاپکردن
          </Button>
          <Button onClick={handleExport} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileSpreadsheet className="h-4 w-4" /> ئێکسڵ
          </Button>
        </div>
      </div>
      <div className="hidden print:block text-center pb-3 border-b">
        <div className="text-xl font-bold">کارگەی خشتی ماد — ڕاپۆرتی قازانج و زیان</div>
        <div className="text-xs text-slate-500 mt-1" dir="ltr">{applied.from} → {applied.to}</div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">بەڕێکردن...</div>
      ) : (
        <div className="space-y-6">
          {cogsMissingCount > 0 && (
            <div className="rounded-md border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 print:hidden">
              <div className="font-bold text-amber-900 dark:text-amber-200 mb-1">
                ⚠️ ئاگاداری: نرخی بەرهەمهێنان بۆ هەندێ فرۆشراو نەدۆزراوەتەوە
              </div>
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <span className="font-semibold">{cogsMissingCount}</span> دانە لە کاڵا فرۆشراوەکان ماددە دیاری نەکراوە (یان ماددەکەی سڕاوەتەوە) — لەبەر ئەوە نرخی کڕینیان بە <span dir="ltr" className="font-semibold">{formatMoney(cogsMissingRevenue)}</span> داهات نەخراوەتە سەر هەژماری لێچوون. قازانجی ڕاستەقینە لەو شتە کەمتر دەبێت. تکایە لە پسووڵە فرۆشراوەکانتدا ماددە دیاری بکە.
              </div>
            </div>
          )}
          {/* Top result cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-r-4 border-r-emerald-500">
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500 mb-1">کۆی داهات</div>
                <div className="text-2xl font-bold text-emerald-600" dir="ltr">{formatMoney(grossIncome)}</div>
                <div className="text-xs text-slate-400 mt-1">فرۆشتن + داهاتی تر</div>
              </CardContent>
            </Card>
            <Card className="border-r-4 border-r-rose-500">
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500 mb-1">کۆی لێچوون و خەرجی</div>
                <div className="text-2xl font-bold text-rose-600" dir="ltr">{formatMoney(totalCostsAndExpenses)}</div>
                <div className="text-xs text-slate-400 mt-1">بەرهەمهێنان + خەرجی + مووچە</div>
              </CardContent>
            </Card>
            <Card className={`border-r-4 ${isProfit ? "border-r-blue-500" : "border-r-rose-700"}`}>
              <CardContent className="pt-4">
                <div className="text-sm text-slate-500 mb-1">{isProfit ? "قازانجی سافی" : "زیانی سافی"}</div>
                <div className={`text-2xl font-bold ${isProfit ? "text-blue-600" : "text-rose-700"}`} dir="ltr">
                  {formatMoney(netProfit)}
                </div>
                <div className="text-xs text-slate-400 mt-1">داهات − لێچوون</div>
              </CardContent>
            </Card>
          </div>

          {/* Step-by-step calculation */}
          <Card className="border-2 border-slate-200 dark:border-slate-700">
            <CardHeader className="border-b pb-3 bg-slate-50 dark:bg-slate-900">
              <CardTitle className="text-base">شێوازی هەژمارکردنی قازانج</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Income block */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 text-emerald-700 dark:text-emerald-400 font-bold">
                  <TrendingUp className="h-4 w-4" />
                  بەشی یەکەم: داهاتەکان
                </div>
                <div className="space-y-1.5 ml-5 mr-5">
                  <CalcLine label="داهاتی فرۆشتن (پسووڵە)" value={totalRevenue} sign="+" />
                  <CalcLine label="داهاتی تر (تۆمارکراو)" value={otherIncome} sign="+" />
                  <CalcLine label="کۆی داهات" value={grossIncome} type="sum" tone="emerald" />
                </div>
              </div>

              {/* Costs block */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 text-rose-700 dark:text-rose-400 font-bold">
                  <TrendingDown className="h-4 w-4" />
                  بەشی دووەم: لێچوون و خەرجی
                </div>
                <div className="space-y-1.5 ml-5 mr-5">
                  <CalcLine label="نرخی بەرهەمهێنانی فرۆشراو (بڕی فرۆشراو × نرخی کڕینی ماددە)" value={productionCost} sign="−" />
                  <CalcLine label="خەرجیە گشتیەکان" value={totalExpenses} sign="−" />
                  <CalcLine label="مووچەی کارمەندان" value={totalPayroll} sign="−" />
                  <CalcLine label="کۆی لێچوون و خەرجی" value={totalCostsAndExpenses} type="sum" tone="rose" />
                </div>
                {totalPurchases > 0 && (
                  <div className="mt-3 mx-5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 rounded p-2 border border-dashed">
                    💡 پسووڵەی کڕینی تۆمارکراو لەو ماوەیەدا: <span dir="ltr" className="font-semibold">{formatMoney(totalPurchases)}</span> — تەنها بۆ زانیاریە، نایخاتە هەژمارەوە (چونکە لە نرخی بەرهەمهێنانەوە دانراوە).
                  </div>
                )}
              </div>

              {/* Net profit */}
              <div className={`rounded-xl p-5 border-2 ${isProfit ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/30" : "bg-rose-50 border-rose-300 dark:bg-rose-950/30"}`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Equal className={`h-5 w-5 ${isProfit ? "text-emerald-700" : "text-rose-700"}`} />
                    <span className="text-lg font-bold">
                      {isProfit ? "قازانجی سافی" : "زیانی سافی"}
                    </span>
                    <span className="text-sm text-slate-500" dir="ltr">
                      = {formatMoney(grossIncome)} − {formatMoney(totalCostsAndExpenses)}
                    </span>
                  </div>
                  <div className={`text-3xl font-bold ${isProfit ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`} dir="ltr">
                    {formatMoney(netProfit)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shareholder breakdown */}
          {report?.profitByShareholdersBreakdown && report.profitByShareholdersBreakdown.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profit BEFORE salary distribution */}
              <Card className="border-emerald-200">
                <CardHeader className="border-b pb-3 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                    <Users className="h-4 w-4" />
                    دابەشکردن — پێش لێبڕینی مووچە
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-3 mb-2 flex justify-between items-center">
                    <span className="text-sm text-slate-600">قازانج پێش مووچە</span>
                    <span className="font-bold text-emerald-700 text-lg" dir="ltr">
                      {formatMoney(netProfit + totalPayroll)}
                    </span>
                  </div>
                  {report.profitByShareholdersBreakdown.map((s, i) => {
                    const totalProfitBeforeSalary = netProfit + totalPayroll;
                    const beforeSalaryShare = (totalProfitBeforeSalary * (s.sharePercentage ?? 0)) / 100;
                    return (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-dashed last:border-0">
                        <div>
                          <div className="font-medium">{s.shareholderName}</div>
                          <div className="text-xs text-slate-500">{s.sharePercentage}%</div>
                        </div>
                        <span className={`font-bold ${beforeSalaryShare >= 0 ? "text-emerald-600" : "text-red-600"}`} dir="ltr">
                          {formatMoney(beforeSalaryShare)}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Profit AFTER salary distribution */}
              <Card className="border-blue-200">
                <CardHeader className="border-b pb-3 bg-blue-50/50 dark:bg-blue-950/20">
                  <CardTitle className="text-base flex items-center gap-2 text-blue-700">
                    <Users className="h-4 w-4" />
                    دابەشکردن — دوای لێبڕینی مووچە
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-3 mb-2 flex justify-between items-center">
                    <span className="text-sm text-slate-600">قازانج دوای مووچە</span>
                    <span className="font-bold text-blue-700 text-lg" dir="ltr">{formatMoney(netProfit)}</span>
                  </div>
                  {report.profitByShareholdersBreakdown.map((s, i) => {
                    const recomputed = (netProfit * (s.sharePercentage ?? 0)) / 100;
                    return (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-dashed last:border-0">
                        <div>
                          <div className="font-medium">{s.shareholderName}</div>
                          <div className="text-xs text-slate-500">{s.sharePercentage}%</div>
                        </div>
                        <span className={`font-bold ${recomputed >= 0 ? "text-blue-600" : "text-red-600"}`} dir="ltr">
                          {formatMoney(recomputed)}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function CalcLine({
  label,
  value,
  sign,
  type = "row",
  tone,
}: {
  label: string;
  value: number;
  sign?: "+" | "−";
  type?: "row" | "sum";
  tone?: "emerald" | "rose";
}) {
  if (type === "sum") {
    const colors = tone === "emerald"
      ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-300"
      : "bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border-rose-300";
    return (
      <div className={`flex items-center justify-between rounded-md border-t-2 px-3 py-2 mt-2 font-bold ${colors}`}>
        <div className="flex items-center gap-2">
          <Equal className="h-4 w-4" />
          <span>{label}</span>
        </div>
        <span className="text-lg tabular-nums" dir="ltr">{formatMoney(value)}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between px-3 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
        <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-bold ${sign === "+" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
          {sign === "+" ? "+" : <Minus className="h-3 w-3" />}
        </span>
        <span className="text-sm">{label}</span>
      </div>
      <span className={`tabular-nums font-semibold ${sign === "+" ? "text-emerald-600" : "text-rose-600"}`} dir="ltr">
        {formatMoney(value)}
      </span>
    </div>
  );
}
