import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListMonthlyClosings, getListMonthlyClosingsQueryKey, useGetMonthlyClosing, getGetMonthlyClosingQueryKey, useCreateMonthlyClosing, useDeleteMonthlyClosing, useReopenMonthlyClosing } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/format";
import { exportTableToExcel } from "@/lib/export";
import { PrintStyles } from "@/components/print-styles";
import { CalendarRange, Plus, Printer, FileSpreadsheet, Eye, Trash2, RotateCcw, Lock, LockOpen } from "lucide-react";

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
const MONTH_NAMES = ["کانوونی دووەم","شوبات","ئازار","نیسان","ئایار","حوزەیران","تەمموز","ئاب","ئەیلوول","تشرینی یەکەم","تشرینی دووەم","کانوونی یەکەم"];

export default function MonthlyClosings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()]);
  const [notes, setNotes] = useState("");
  const [viewId, setViewId] = useState<number | null>(null);

  const { data: closings, isLoading } = useListMonthlyClosings({ query: { queryKey: getListMonthlyClosingsQueryKey() } });

  const create = useCreateMonthlyClosing({ mutation: { onSuccess: () => { toast({ title: "مانگ داخرا" }); qc.invalidateQueries({ queryKey: getListMonthlyClosingsQueryKey() }); setOpen(false); setNotes(""); }, onError: (err: unknown) => { const e = err as { data?: { error?: string }; error?: string }; const code = e.data?.error ?? e.error; toast({ title: code === "already_closed" ? "ئەم مانگە پێشتر داخراوە" : "هەڵە لە داخستن", variant: "destructive" }); } } });
  const del = useDeleteMonthlyClosing({ mutation: { onSuccess: () => { toast({ title: "سڕایەوە" }); qc.invalidateQueries({ queryKey: getListMonthlyClosingsQueryKey() }); } } });
  const reopen = useReopenMonthlyClosing({ mutation: { onSuccess: () => { toast({ title: "کرایەوە بۆ دەستکاری" }); qc.invalidateQueries({ queryKey: getListMonthlyClosingsQueryKey() }); } } });

  const exportExcel = () => {
    const rows = (closings ?? []).map((c) => `<tr><td>${c.year}-${c.month}</td><td>${c.status === "closed" ? "داخراو" : "کراوە"}</td><td>${Number(c.totalSales).toLocaleString("en-US")}</td><td>${Number(c.totalPurchases).toLocaleString("en-US")}</td><td>${Number(c.totalExpenses).toLocaleString("en-US")}</td><td>${Number(c.totalPayroll).toLocaleString("en-US")}</td><td>${Number(c.netProfit).toLocaleString("en-US")}</td></tr>`).join("");
    exportTableToExcel("monthly-closings.xls", `<h2>داخستنە مانگانەکان</h2><table><thead><tr><th>مانگ</th><th>دۆخ</th><th>فرۆشتن</th><th>کڕین</th><th>خەرجی</th><th>مووچە</th><th>قازانجی پاک</th></tr></thead><tbody>${rows}</tbody></table>`);
  };

  return (
    <div className="space-y-6">
      <PrintStyles />
      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CalendarRange className="h-6 w-6 text-primary" />داخستنە مانگانەکان
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" />چاپ</Button>
          <Button variant="outline" onClick={exportExcel} className="gap-2"><FileSpreadsheet className="h-4 w-4" />ئێگزڵ</Button>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" />داخستنی مانگ</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">مانگ</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">دۆخ</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">فرۆشتن</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">کڕین</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">خەرجی</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">مووچە</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">قازانجی پاک</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">بەرواری داخستن</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center w-28 print:hidden">کارەکان</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : !closings?.length ? (
                <tr><td colSpan={9} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ داخستنێک نییە</td></tr>
              ) : closings.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center font-bold tabular-nums" dir="ltr">{c.year}-{c.month}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center">
                    {c.status === "closed"
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700"><Lock className="h-3 w-3" />داخراو</span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700"><LockOpen className="h-3 w-3" />کراوە</span>}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(c.totalSales)}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(c.totalPurchases)}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(c.totalExpenses)}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(c.totalPayroll)}</td>
                  <td className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold ${c.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`} dir="ltr">{formatMoney(c.netProfit)}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center text-xs tabular-nums" dir="ltr">{new Date(c.closedAt).toLocaleDateString("en-CA")}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center print:hidden">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setViewId(c.id)} className="inline-flex items-center justify-center p-1.5 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-100 transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      {c.status === "closed" && (
                        <button onClick={() => reopen.mutate({ id: c.id })} title="کردنەوە" className="inline-flex items-center justify-center p-1.5 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100 transition-colors">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => { if (confirm("دڵنیایت لە سڕینەوە؟")) del.mutate({ id: c.id }); }} className="inline-flex items-center justify-center p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>داخستنی مانگی نوێ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-600">ساڵ</label><Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
              <div><label className="text-xs text-slate-600">مانگ</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={m}>{MONTH_NAMES[i]} ({m})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><label className="text-xs text-slate-600">تێبینی</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">ئەم کارە هەموو ژمارەکانی ئەم مانگە بە شێوەی نەگۆڕ دەنووسێت و بەشی شریکەکان دیاری دەکات.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>پاشگەزبوونەوە</Button>
            <Button onClick={() => create.mutate({ data: { year, month, notes: notes || null } })} disabled={create.isPending}>داخستن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewId !== null && <ClosingDetail id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function ClosingDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useGetMonthlyClosing(id, { query: { queryKey: getGetMonthlyClosingQueryKey(id) } });
  if (!data) return null;
  const { closing, distributions } = data;

  const exportExcel = () => {
    const distRows = distributions.map((d) => `<tr><td>${d.shareholderName}</td><td>${d.sharePercentage}%</td><td>${Number(d.amount).toLocaleString("en-US")}</td><td>${Number(d.paidAmount).toLocaleString("en-US")}</td></tr>`).join("");
    const html = `<h2>داخستنی مانگی ${closing.year}-${closing.month}</h2><table><thead><tr><th>شریک</th><th>ڕێژە</th><th>بڕ</th><th>دراو</th></tr></thead><tbody>${distRows}</tbody></table>`;
    exportTableToExcel(`closing-${closing.year}-${closing.month}.xls`, html);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>داخستنی مانگی {closing.year}-{closing.month}</span>
            <div className="flex gap-2 print:hidden">
              <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1"><Printer className="h-3 w-3" />چاپ</Button>
              <Button size="sm" variant="outline" onClick={exportExcel} className="gap-1"><FileSpreadsheet className="h-3 w-3" />ئێگزڵ</Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "فرۆشتن", value: closing.totalSales, pos: true },
              { label: "کڕین", value: closing.totalPurchases, neg: true },
              { label: "قازانجی گشتی", value: closing.grossProfit, pos: true },
              { label: "خەرجی", value: closing.totalExpenses, neg: true },
              { label: "مووچە", value: closing.totalPayroll, neg: true },
              { label: "داهاتی تر", value: closing.totalOtherIncome, pos: true },
              { label: "هاتنە ژوور", value: closing.cashIn, pos: true },
              { label: "چوونە دەرەوە", value: closing.cashOut, neg: true },
            ].map(({ label, value, pos, neg }) => (
              <div key={label} className="rounded-lg p-3 bg-slate-50 border">
                <div className="text-xs text-slate-500 mb-1">{label}</div>
                <div className={`text-lg font-bold ${pos ? "text-emerald-700" : neg ? "text-rose-700" : "text-slate-900"}`} dir="ltr">{formatMoney(value)}</div>
              </div>
            ))}
            <div className="col-span-2 rounded-lg p-3 bg-blue-50 border border-blue-200">
              <div className="text-xs text-slate-500">قازانجی پاک</div>
              <div className={`text-2xl font-bold ${closing.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`} dir="ltr">{formatMoney(closing.netProfit)}</div>
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-2">دابەشکردنی قازانج</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  <th className="border border-slate-300 px-3 py-2 font-semibold">شریک</th>
                  <th className="border border-slate-300 px-3 py-2 font-semibold text-left">ڕێژە</th>
                  <th className="border border-slate-300 px-3 py-2 font-semibold text-left">بڕ</th>
                  <th className="border border-slate-300 px-3 py-2 font-semibold text-left">دراو</th>
                </tr>
              </thead>
              <tbody>
                {distributions.length === 0 ? (
                  <tr><td colSpan={4} className="border border-slate-300 px-3 py-4 text-center text-slate-500">هیچ شریکێک نییە</td></tr>
                ) : distributions.map((d, i) => (
                  <tr key={d.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="border border-slate-300 px-3 py-2 font-semibold">{d.shareholderName}</td>
                    <td className="border border-slate-300 px-3 py-2 text-left tabular-nums" dir="ltr">{d.sharePercentage}%</td>
                    <td className="border border-slate-300 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(d.amount)}</td>
                    <td className="border border-slate-300 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{formatMoney(d.paidAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {closing.notes && <p className="text-sm text-slate-600 bg-slate-50 rounded p-2">{closing.notes}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
