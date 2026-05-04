import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { useListIncomes, useCreateIncome, useDeleteIncome, getListIncomesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { TrendingUp, Plus, Trash2 } from "lucide-react";

const CATEGORIES = ["خزمەتگوزاری", "کرێ", "بەخشین", "داهاتی تر"];

export default function Incomes() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: CATEGORIES[0], description: "", amount: "", incomeDate: new Date().toISOString().split("T")[0], notes: "" });

  const { data: incomes, isLoading } = useListIncomes({}, { query: { queryKey: getListIncomesQueryKey({}) } });
  const { mutate: create, isPending: creating } = useCreateIncome({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListIncomesQueryKey({}) }); setOpen(false); setForm({ category: CATEGORIES[0], description: "", amount: "", incomeDate: new Date().toISOString().split("T")[0], notes: "" }); } } });
  const { mutate: del } = useDeleteIncome({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListIncomesQueryKey({}) }) } });

  const total = (incomes ?? []).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" />داهاتی تر</h1>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" />داهات زیادکردن</Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold w-8">ژ</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold">جۆر</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold">وەسف</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-left font-semibold">بڕ (د.ع)</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-center font-semibold">بەروار</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : !incomes?.length ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ داهاتێک نەدۆزرایەوە</td></tr>
              ) : incomes.map((inc, i) => (
                <tr key={inc.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center text-slate-400">{i + 1}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2"><span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs">{inc.category}</span></td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-medium">{inc.description}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold text-emerald-600" dir="ltr">{formatMoney(inc.amount)}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center" dir="ltr">{inc.incomeDate}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                    <button onClick={() => del({ id: inc.id })} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900 text-destructive transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {(incomes?.length ?? 0) > 0 && (
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <td colSpan={3} className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-right">کۆی گشتی ({incomes?.length})</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-emerald-700" dir="ltr">{formatMoney(total)}</td>
                  <td colSpan={2} className="border border-slate-300 dark:border-slate-600 px-3 py-2"></td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>داهات زیادکردن</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>جۆری داهات</Label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border rounded px-3 py-2 mt-1 bg-white dark:bg-slate-900">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><Label>وەسف</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="وەسفی داهات..." /></div>
            <div><Label>بڕ (د.ع)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></div>
            <div><Label>بەروار</Label><Input type="date" value={form.incomeDate} onChange={(e) => setForm({ ...form, incomeDate: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>هەڵوەشاندنەوە</Button>
            <Button onClick={() => { if (!form.description || !form.amount) return; create({ data: { category: form.category, description: form.description, amount: Number(form.amount), incomeDate: form.incomeDate } }); }} disabled={creating}>{creating ? "تۆمارکردن..." : "تۆمارکردن"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
