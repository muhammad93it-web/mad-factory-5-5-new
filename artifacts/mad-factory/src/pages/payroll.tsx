import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { useListPayrollEntries, useCreatePayrollEntry, useDeletePayrollEntry, useListEmployees, getListPayrollEntriesQueryKey, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus, Trash2, Printer } from "lucide-react";

export default function Payroll() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const today = new Date();
  const curPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [form, setForm] = useState({ employeeId: "", period: curPeriod, baseSalary: "", bonus: "0", deductions: "0", paidAmount: "0", paymentDate: today.toISOString().split("T")[0], notes: "" });

  const { data: entries, isLoading } = useListPayrollEntries({}, { query: { queryKey: getListPayrollEntriesQueryKey({}) } });
  const { data: employees } = useListEmployees({}, { query: { queryKey: getListEmployeesQueryKey({}) } });
  const { mutate: create, isPending: creating } = useCreatePayrollEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPayrollEntriesQueryKey({}) });
        setOpen(false);
      },
    },
  });
  const { mutate: del } = useDeletePayrollEntry({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPayrollEntriesQueryKey({}) }) },
  });

  const handleEmpChange = (empId: string) => {
    const emp = employees?.find((e) => e.id === Number(empId));
    setForm({ ...form, employeeId: empId, baseSalary: emp ? String(emp.salary) : "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Banknote className="h-6 w-6 text-primary" />
          مووچەی کارمەندان
        </h1>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          مووچە تۆمارکردن
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold">کارمەند</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-center font-semibold">سەردەم</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-left font-semibold">مووچەی بنەڕەت</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-left font-semibold">زیادکراوە</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-left font-semibold">کەمکراوە</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-left font-semibold">کۆی دواوی</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-left font-semibold">دراوە</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-left font-semibold">ماوە</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-center font-semibold w-24">کارەکان</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td>
                </tr>
              ) : !entries?.length ? (
                <tr>
                  <td colSpan={9} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ مووچەیەک نەدۆزرایەوە</td>
                </tr>
              ) : entries.map((e, i) => {
                const remain = Number(e.remainingAmount);
                return (
                  <tr key={e.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-medium">{e.employeeName}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center tabular-nums" dir="ltr">{e.period}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums" dir="ltr">{formatMoney(e.baseSalary)}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-emerald-600" dir="ltr">{e.bonus > 0 ? formatMoney(e.bonus) : <span className="text-slate-300">—</span>}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-red-500" dir="ltr">{e.deductions > 0 ? formatMoney(e.deductions) : <span className="text-slate-300">—</span>}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(e.totalDue)}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums text-emerald-600 font-semibold" dir="ltr">{formatMoney(e.paidAmount)}</td>
                    <td className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold ${remain > 0 ? "text-destructive" : "text-slate-400"}`} dir="ltr">{formatMoney(remain)}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/payroll/slip/${e.employeeId}`)}
                          title="چاپکردنی وەسڵ"
                          className="inline-flex items-center justify-center p-1.5 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-100 transition-colors"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => del({ id: e.id })}
                          title="سڕینەوە"
                          className="inline-flex items-center justify-center p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>تۆمارکردنی مووچە</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>کارمەند</Label>
                <select value={form.employeeId} onChange={(e) => handleEmpChange(e.target.value)} className="w-full border rounded px-3 py-2 mt-1 bg-white dark:bg-slate-900">
                  <option value="">کارمەند هەڵبژێرە...</option>
                  {employees?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div><Label>سەردەم</Label><Input type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>مووچەی بنەڕەت</Label><Input type="number" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} /></div>
              <div><Label>زیادکراوە</Label><Input type="number" value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value })} /></div>
              <div><Label>کەمکراوە</Label><Input type="number" value={form.deductions} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>دراوە</Label><Input type="number" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} /></div>
              <div><Label>بەروار</Label><Input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>هەڵوەشاندنەوە</Button>
            <Button onClick={() => {
              if (!form.employeeId || !form.baseSalary) return;
              create({ data: { employeeId: Number(form.employeeId), period: form.period, baseSalary: Number(form.baseSalary), bonus: Number(form.bonus), deductions: Number(form.deductions), paidAmount: Number(form.paidAmount), paymentDate: form.paymentDate } });
            }} disabled={creating}>{creating ? "تۆمارکردن..." : "تۆمارکردن"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
