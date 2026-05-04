import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { useGetMonthlyReport } from "@workspace/api-client-react";
import { FileText, TrendingUp, TrendingDown } from "lucide-react";

const months = [
  { value: "01", label: "کانوونی دووەم" }, { value: "02", label: "شوبات" }, { value: "03", label: "ئازار" },
  { value: "04", label: "نیسان" }, { value: "05", label: "ئایار" }, { value: "06", label: "حوزەیران" },
  { value: "07", label: "تەمموز" }, { value: "08", label: "ئاب" }, { value: "09", label: "ئەیلول" },
  { value: "10", label: "تشرینی یەکەم" }, { value: "11", label: "تشرینی دووەم" }, { value: "12", label: "کانوونی یەکەم" },
];

export default function MonthlyReport() {
  const today = new Date();
  const [year, setYear] = useState(String(today.getFullYear()));
  const [month, setMonth] = useState(String(today.getMonth() + 1).padStart(2, "0"));

  const { data: report, isLoading } = useGetMonthlyReport(
    { year: Number(year), month },
    { query: { queryKey: ["monthlyReport", year, month] } }
  );

  const rows = [
    { label: "کۆی فرۆشتن", value: report?.totalSales, color: "text-emerald-600", type: "income" },
    { label: "داهاتی تر", value: report?.totalOtherIncome, color: "text-emerald-600", type: "income" },
    { label: "کۆی کڕین", value: report?.totalPurchases, color: "text-red-600", type: "expense" },
    { label: "خەرجیەکان", value: report?.totalExpenses, color: "text-red-600", type: "expense" },
    { label: "مووچەکان", value: report?.totalPayroll, color: "text-red-600", type: "expense" },
    { label: "دەرکردنی شریکەکان", value: report?.totalShareholderWithdrawals, color: "text-amber-600", type: "expense" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          ڕاپۆرتی مانگانە
        </h1>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded px-3 py-2 bg-white dark:bg-slate-900">
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-24 text-center" min="2020" max="2030" />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">بەڕێکردن...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2 text-emerald-700">
                <TrendingUp className="h-4 w-4" />
                داهاتەکان
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {rows.filter((r) => r.type === "income").map((r) => (
                <div key={r.label} className="flex justify-between items-center py-2 border-b border-dashed last:border-0">
                  <span className="text-slate-600">{r.label}</span>
                  <span className={`font-bold ${r.color}`}>{formatMoney(r.value)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 font-bold border-t">
                <span>کۆی داهات</span>
                <span className="text-emerald-600 text-lg">{formatMoney((report?.totalSales ?? 0) + (report?.totalOtherIncome ?? 0))}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                <TrendingDown className="h-4 w-4" />
                خەرجیەکان
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {rows.filter((r) => r.type === "expense").map((r) => (
                <div key={r.label} className="flex justify-between items-center py-2 border-b border-dashed last:border-0">
                  <span className="text-slate-600">{r.label}</span>
                  <span className={`font-bold ${r.color}`}>{formatMoney(r.value)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 font-bold border-t">
                <span>کۆی خەرجی</span>
                <span className="text-red-600 text-lg">{formatMoney((report?.totalPurchases ?? 0) + (report?.totalExpenses ?? 0) + (report?.totalPayroll ?? 0))}</span>
              </div>
            </CardContent>
          </Card>

          <Card className={`md:col-span-2 border-2 ${(report?.netProfit ?? 0) >= 0 ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950' : 'border-red-300 bg-red-50 dark:bg-red-950'}`}>
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center">
                  <div className="text-slate-500 text-sm mb-1">قازانجی خام</div>
                  <div className={`text-xl font-bold ${(report?.grossProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(report?.grossProfit)}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-500 text-sm mb-1">پارەی چووە ژوورەوە</div>
                  <div className="text-xl font-bold text-emerald-600">{formatMoney(report?.cashIn)}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-500 text-sm mb-1">پارەی چووە دەرەوە</div>
                  <div className="text-xl font-bold text-red-600">{formatMoney(report?.cashOut)}</div>
                </div>
                <div className="text-center border-r pr-4 md:border-r border-dashed">
                  <div className="text-slate-500 text-sm mb-1">قازانجی سافی</div>
                  <div className={`text-3xl font-bold ${(report?.netProfit ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(report?.netProfit)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
