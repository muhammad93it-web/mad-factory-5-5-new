import { useRoute, useLocation } from "wouter";
import { useListPayrollEntries, useListEmployees, getListPayrollEntriesQueryKey, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { ArrowRight, Printer, FileSpreadsheet } from "lucide-react";
import { PrintStyles } from "@/components/print-styles";
import { exportTableToExcel, buildInvoiceTableHtml } from "@/lib/export";

function parseYM(period: string) {
  const [y, m] = period.split("-");
  return { year: y ?? "", month: m ?? "" };
}

const MONTH_NAMES: Record<string, string> = {
  "01": "کانوونی دووەم", "02": "شوبات", "03": "ئازار",
  "04": "نیسان", "05": "ئایار", "06": "حوزەیران",
  "07": "تەممووز", "08": "ئاب", "09": "ئەیلوول",
  "10": "تشرینی یەکەم", "11": "تشرینی دووەم", "12": "کانوونی یەکەم",
};

export default function PayrollSlip() {
  const [, params] = useRoute("/payroll/slip/:id");
  const [, navigate] = useLocation();
  const empId = params?.id ? Number(params.id) : 0;

  const { data: entries, isLoading } = useListPayrollEntries(
    { employeeId: empId },
    { query: { enabled: !!empId, queryKey: getListPayrollEntriesQueryKey({ employeeId: empId }) } }
  );
  const { data: employees } = useListEmployees({}, { query: { queryKey: getListEmployeesQueryKey({}) } });

  const employee = employees?.find((e) => e.id === empId);
  const sorted = [...(entries ?? [])].sort((a, b) => a.period.localeCompare(b.period));

  const totalBase   = sorted.reduce((s, e) => s + e.baseSalary, 0);
  const totalBonus  = sorted.reduce((s, e) => s + e.bonus, 0);
  const totalDeduct = sorted.reduce((s, e) => s + e.deductions, 0);
  const totalDue    = sorted.reduce((s, e) => s + e.totalDue, 0);
  const totalPaid   = sorted.reduce((s, e) => s + e.paidAmount, 0);
  const totalRemain = sorted.reduce((s, e) => s + Number(e.remainingAmount), 0);

  const handleExport = () => {
    const html = buildInvoiceTableHtml({
      title: `وەسڵی مووچە — ${employee?.name ?? ""}`,
      meta: [["ناوی کارمەند", employee?.name ?? ""], ["کۆد", employee?.code ?? ""]],
      itemHeaders: ["ژ", "سال", "مانگ", "مووچەی بنەڕەت", "زیادکراوە", "کەمکراوە", "کۆی دواوی", "دراوە", "ماوە", "تێبینی"],
      itemRows: sorted.map((e, i) => {
        const { year, month } = parseYM(e.period);
        return [i + 1, year, MONTH_NAMES[month] ?? month, e.baseSalary.toLocaleString(), e.bonus.toLocaleString(), e.deductions.toLocaleString(), e.totalDue.toLocaleString(), e.paidAmount.toLocaleString(), Number(e.remainingAmount).toLocaleString(), e.notes ?? ""];
      }),
      totals: [
        ["کۆی مووچەی بنەڕەت", totalBase.toLocaleString()],
        ["کۆی زیادکراوە", totalBonus.toLocaleString()],
        ["کۆی کەمکراوە", totalDeduct.toLocaleString()],
        ["کۆی دواوی", totalDue.toLocaleString()],
        ["کۆی دراوە", totalPaid.toLocaleString()],
        ["باقی ماوە", totalRemain.toLocaleString()],
      ],
    });
    exportTableToExcel(`payroll-slip-${employee?.name ?? empId}.xls`, html);
  };

  if (isLoading) return <div className="p-8 text-center text-slate-500">بەڕێکردن...</div>;

  return (
    <div className="space-y-4">
      <PrintStyles />

      {/* Action Bar */}
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">وەسڵی تاکی مووچەی کارمەندان و کریکاران</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/payroll")} className="gap-2">
            <ArrowRight className="h-4 w-4" /> گەڕانەوە
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> چاپکردن
          </Button>
          <Button onClick={handleExport} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <FileSpreadsheet className="h-4 w-4" /> ئێکسڵ
          </Button>
        </div>
      </div>

      {/* Slip Document */}
      <div className="print-area bg-white border-2 border-slate-400 text-slate-900" dir="rtl">

        {/* Title bar */}
        <div className="bg-sky-100 border-b-2 border-slate-400 px-4 py-3 text-center">
          <h2 className="text-lg font-extrabold tracking-wide">وەسڵی تاکی مووچەی کارمەندان و کریکاران</h2>
        </div>

        {/* Employee meta — 3 cells */}
        <div className="border-b-2 border-slate-400">
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr>
                <th className="border border-slate-400 bg-sky-50 px-3 py-2 w-36 text-right font-bold">ژمارەی وەصل</th>
                <td className="border border-slate-400 px-3 py-2 font-mono w-28" dir="ltr">
                  {String(empId).padStart(4, "0")}
                </td>
                <th className="border border-slate-400 bg-sky-50 px-3 py-2 w-36 text-right font-bold">ناوی سیانی</th>
                <td className="border border-slate-400 px-3 py-2 font-bold">{employee?.name ?? "—"}</td>
                <th className="border border-slate-400 bg-sky-50 px-3 py-2 w-28 text-right font-bold">مۆبایل</th>
                <td className="border border-slate-400 px-3 py-2" dir="ltr">{employee?.phone ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payroll entries table */}
        <div className="p-0">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-sky-200 text-slate-800 font-bold">
                <th className="border border-slate-400 px-2 py-2 w-8 text-center">ژ</th>
                <th className="border border-slate-400 px-2 py-2 w-14 text-center">سال</th>
                <th className="border border-slate-400 px-2 py-2 w-28 text-center">مانگ</th>
                <th className="border border-slate-400 px-3 py-2 text-center">مووچەی بنەڕەت</th>
                <th className="border border-slate-400 px-3 py-2 text-center">زیادکراوە</th>
                <th className="border border-slate-400 px-3 py-2 text-center">کەمکراوە</th>
                <th className="border border-slate-400 px-3 py-2 text-center">کۆی دواوی</th>
                <th className="border border-slate-400 px-3 py-2 text-center">دراوە</th>
                <th className="border border-slate-400 px-3 py-2 text-center">ماوە</th>
                <th className="border border-slate-400 px-3 py-2 text-center">تێبینی</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="border border-slate-400 px-3 py-8 text-center text-slate-400">
                    هیچ تۆمارێک نەدۆزرایەوە
                  </td>
                </tr>
              ) : sorted.map((e, i) => {
                const { year, month } = parseYM(e.period);
                const remain = Number(e.remainingAmount);
                const isOdd = i % 2 === 1;
                return (
                  <tr key={e.id} className={isOdd ? "bg-slate-50" : "bg-white"}>
                    <td className="border border-slate-400 px-2 py-1.5 text-center text-slate-500">{i + 1}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center tabular-nums" dir="ltr">{year}</td>
                    <td className="border border-slate-400 px-2 py-1.5 text-center">{MONTH_NAMES[month] ?? month}</td>
                    <td className="border border-slate-400 px-3 py-1.5 text-left tabular-nums" dir="ltr">{e.baseSalary.toLocaleString()}</td>
                    <td className={`border border-slate-400 px-3 py-1.5 text-left tabular-nums ${e.bonus > 0 ? "text-emerald-700 font-semibold" : "text-slate-400"}`} dir="ltr">
                      {e.bonus > 0 ? e.bonus.toLocaleString() : "—"}
                    </td>
                    <td className={`border border-slate-400 px-3 py-1.5 text-left tabular-nums ${e.deductions > 0 ? "text-red-600 font-semibold" : "text-slate-400"}`} dir="ltr">
                      {e.deductions > 0 ? e.deductions.toLocaleString() : "—"}
                    </td>
                    <td className="border border-slate-400 px-3 py-1.5 text-left tabular-nums font-bold" dir="ltr">{e.totalDue.toLocaleString()}</td>
                    <td className="border border-slate-400 px-3 py-1.5 text-left tabular-nums text-emerald-700 font-semibold" dir="ltr">{e.paidAmount.toLocaleString()}</td>
                    <td className={`border border-slate-400 px-3 py-1.5 text-left tabular-nums font-bold ${remain > 0 ? "text-red-600 bg-red-50" : "text-slate-400"}`} dir="ltr">
                      {remain > 0 ? remain.toLocaleString() : "0"}
                    </td>
                    <td className="border border-slate-400 px-3 py-1.5 text-xs text-slate-500">{e.notes ?? ""}</td>
                  </tr>
                );
              })}

              {/* Filler rows */}
              {Array.from({ length: Math.max(0, 5 - sorted.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className={i % 2 === (sorted.length % 2) ? "bg-slate-50" : "bg-white"}>
                  <td className="border border-slate-400 px-2 py-1.5 text-center text-slate-300">{sorted.length + i + 1}</td>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="border border-slate-400 px-3 py-1.5">&nbsp;</td>
                  ))}
                </tr>
              ))}

              {/* Totals row */}
              <tr className="bg-sky-100 font-bold text-slate-800">
                <td colSpan={3} className="border border-slate-400 px-3 py-2 text-center">کۆی گشتی</td>
                <td className="border border-slate-400 px-3 py-2 text-left tabular-nums" dir="ltr">{totalBase.toLocaleString()}</td>
                <td className="border border-slate-400 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{totalBonus > 0 ? totalBonus.toLocaleString() : "—"}</td>
                <td className="border border-slate-400 px-3 py-2 text-left tabular-nums text-red-600" dir="ltr">{totalDeduct > 0 ? totalDeduct.toLocaleString() : "—"}</td>
                <td className="border border-slate-400 px-3 py-2 text-left tabular-nums" dir="ltr">{totalDue.toLocaleString()}</td>
                <td className="border border-slate-400 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{totalPaid.toLocaleString()}</td>
                <td className={`border border-slate-400 px-3 py-2 text-left tabular-nums ${totalRemain > 0 ? "text-red-600" : ""}`} dir="ltr">{totalRemain.toLocaleString()}</td>
                <td className="border border-slate-400 px-3 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer summary + signature */}
        <div className="border-t-2 border-slate-400 px-4 py-3 grid grid-cols-3 gap-6 text-sm">
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-600">کۆی پارەی دراوە:</span>
              <span className="font-bold text-emerald-700 tabular-nums" dir="ltr">{formatMoney(totalPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">باقی ماوە:</span>
              <span className={`font-bold tabular-nums ${totalRemain > 0 ? "text-red-600" : "text-slate-500"}`} dir="ltr">{formatMoney(totalRemain)}</span>
            </div>
          </div>
          <div className="text-center">
            <div className="mt-6 border-t border-slate-400 pt-1.5 text-xs text-slate-500">واژۆی کارمەند</div>
          </div>
          <div className="text-center">
            <div className="mt-6 border-t border-slate-400 pt-1.5 text-xs text-slate-500">واژۆی بەڕێوەبەر</div>
          </div>
        </div>
      </div>
    </div>
  );
}
