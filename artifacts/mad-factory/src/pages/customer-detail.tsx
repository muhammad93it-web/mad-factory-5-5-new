import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import {
  useGetCustomer,
  getGetCustomerQueryKey,
  useGetCustomerStatement,
  getGetCustomerStatementQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, formatDate } from "@/lib/format";
import { exportTableToExcel } from "@/lib/export";
import { PrintStyles } from "@/components/print-styles";
import {
  ArrowRight, Printer, FileSpreadsheet, User, Phone, MapPin, FileText, Calendar,
} from "lucide-react";

export default function CustomerDetail() {
  const [, params] = useRoute("/customers/:id");
  const [, navigate] = useLocation();
  const id = params?.id ? parseInt(params.id) : 0;

  const today = new Date();
  const [fromDate, setFromDate] = useState(`${today.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(today.toISOString().split("T")[0]);
  const [applied, setApplied] = useState({ fromDate, toDate });

  const { data: customer, isLoading: loadingCust } = useGetCustomer(id, {
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) },
  });
  const { data: statement, isLoading: loadingStmt } = useGetCustomerStatement(
    id,
    { fromDate: applied.fromDate, toDate: applied.toDate },
    { query: { enabled: !!id, queryKey: getGetCustomerStatementQueryKey(id, { fromDate: applied.fromDate, toDate: applied.toDate }) } },
  );

  if (loadingCust) return <div className="p-8 text-center text-slate-500">بەڕێکردن...</div>;
  if (!customer) return <div className="p-8 text-center text-destructive">کڕیار نەدۆزرایەوە</div>;

  const handleExport = () => {
    const headers = ["#", "بەروار", "وەسف", "قەرز (د.ع)", "پارەدان (د.ع)", "ماوە (د.ع)"];
    const headerRow = `<tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;
    const bodyRows = (statement?.entries ?? [])
      .map((e, i) => `<tr>
        <td>${i + 1}</td>
        <td>${formatDate(e.date)}</td>
        <td>${e.description}</td>
        <td>${e.debit ? e.debit.toLocaleString() : ""}</td>
        <td>${e.credit ? e.credit.toLocaleString() : ""}</td>
        <td>${e.balance.toLocaleString()}</td>
      </tr>`)
      .join("");
    const totals = `
      <tr><th colspan="3">سەرەتای دەوام</th><td colspan="3">${(statement?.openingBalance ?? 0).toLocaleString()} د.ع</td></tr>
      <tr><th colspan="3">کۆی قەرز</th><td colspan="3">${(statement?.totalDebit ?? 0).toLocaleString()} د.ع</td></tr>
      <tr><th colspan="3">کۆی پارەدان</th><td colspan="3">${(statement?.totalCredit ?? 0).toLocaleString()} د.ع</td></tr>
      <tr><th colspan="3">قەرزی کۆتایی</th><td colspan="3"><b>${(statement?.closingBalance ?? 0).toLocaleString()} د.ع</b></td></tr>`;
    const html = `
      <h2 style="text-align:right">کەشف حسابی کڕیار: ${customer.name}</h2>
      <p style="text-align:right">لە ${formatDate(applied.fromDate)} تا ${formatDate(applied.toDate)}</p>
      <table>${headerRow}${bodyRows}${totals}</table>`;
    exportTableToExcel(`statement-customer-${customer.id}.xls`, html);
  };

  return (
    <div className="space-y-5">
      <PrintStyles />

      {/* Action Bar */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          کەشف حسابی کڕیار
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/customers")} className="gap-2">
            <ArrowRight className="h-4 w-4" />گەڕانەوە
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />چاپکردن
          </Button>
          <Button onClick={handleExport} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileSpreadsheet className="h-4 w-4" />هەناردەکردن بۆ ئێکسڵ
          </Button>
        </div>
      </div>

      {/* Document */}
      <Card className="print-area shadow-sm border-slate-200">
        <CardContent className="p-8 space-y-6">
          {/* Document Header */}
          <div className="flex items-start justify-between pb-5 border-b-2 border-primary">
            <div>
              <h2 className="text-2xl font-bold text-primary">کارگەی خشتی ماد</h2>
              <p className="text-sm text-slate-500 mt-1">کەشف حسابی کڕیار / Customer Statement</p>
            </div>
            <div className="text-left">
              <div className="text-xs text-slate-500 mb-1">ناوی کڕیار</div>
              <div className="text-xl font-bold text-primary">{customer.name}</div>
              <div className="text-xs text-slate-500 mt-2 flex items-center justify-end gap-1.5">
                <Calendar className="h-3 w-3" />{formatDate(applied.fromDate)} — {formatDate(applied.toDate)}
              </div>
            </div>
          </div>

          {/* Customer Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1"><Phone className="h-3 w-3" />مۆبایل ١</div>
              <div className="font-medium" dir="ltr">{customer.phone || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1"><Phone className="h-3 w-3" />مۆبایل ٢</div>
              <div className="font-medium" dir="ltr">{customer.phone2 || "-"}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1"><MapPin className="h-3 w-3" />ناونیشان</div>
              <div className="font-medium">{customer.address || "-"}</div>
            </div>
          </div>

          {/* Date Filter */}
          <div className="flex flex-wrap items-end gap-3 print:hidden bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
            <div>
              <Label className="text-xs">لە بەرواری</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs">تا بەرواری</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-40" />
            </div>
            <Button onClick={() => setApplied({ fromDate, toDate })}>پیشاندان</Button>
          </div>

          {/* Statement Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center w-10">#</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">بەروار</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">وەسف</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">قەرز</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">پارەدان</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">ماوە</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-amber-50 dark:bg-amber-900/20 font-semibold">
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center text-slate-400">—</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center">—</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2">سەرەتای دەوام</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left" dir="ltr">{(statement?.openingBalance ?? 0) > 0 ? formatMoney(statement?.openingBalance) : ""}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left" dir="ltr">{(statement?.openingBalance ?? 0) < 0 ? formatMoney(-(statement?.openingBalance ?? 0)) : ""}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left font-bold" dir="ltr">{formatMoney(statement?.openingBalance)}</td>
                </tr>
                {loadingStmt ? (
                  <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
                ) : (statement?.entries ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-400">هیچ مامەڵەیەک نییە لەم ماوەیەدا</td></tr>
                ) : (
                  statement!.entries.map((e, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                      <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center text-slate-400">{i + 1}</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center whitespace-nowrap tabular-nums" dir="ltr">{formatDate(e.date)}</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-3 py-2">
                        {e.type === "invoice" && e.referenceId ? (
                          <Link href={`/sales/${e.referenceId}`} className="text-primary hover:underline">{e.description}</Link>
                        ) : e.description}
                      </td>
                      <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-rose-600 font-semibold" dir="ltr">{e.debit ? formatMoney(e.debit) : ""}</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-emerald-600 font-semibold" dir="ltr">{e.credit ? formatMoney(e.credit) : ""}</td>
                      <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(e.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-4 border-t">
            <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-1">سەرەتای دەوام</div>
              <div className="text-lg font-bold" dir="ltr">{formatMoney(statement?.openingBalance)}</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3">
              <div className="text-xs text-rose-700 dark:text-rose-400 mb-1">کۆی قەرز</div>
              <div className="text-lg font-bold text-rose-700 dark:text-rose-400" dir="ltr">{formatMoney(statement?.totalDebit)}</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
              <div className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">کۆی پارەدان</div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400" dir="ltr">{formatMoney(statement?.totalCredit)}</div>
            </div>
            <div className={`rounded-lg p-3 ${(statement?.closingBalance ?? 0) > 0 ? "bg-rose-100 dark:bg-rose-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}`}>
              <div className="text-xs mb-1">قەرزی کۆتایی</div>
              <div className={`text-xl font-bold ${(statement?.closingBalance ?? 0) > 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`} dir="ltr">
                {formatMoney(statement?.closingBalance)}
              </div>
            </div>
          </div>

          {customer.notes && (
            <div className="pt-4 border-t">
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1"><FileText className="h-3 w-3" />تێبینی</div>
              <div className="text-sm whitespace-pre-wrap">{customer.notes}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
