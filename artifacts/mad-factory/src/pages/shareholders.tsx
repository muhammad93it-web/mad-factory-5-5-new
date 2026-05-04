import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { useListShareholders, useCreateShareholder, useCreateShareholderTransaction, useListShareholderTransactions, getListShareholdersQueryKey, getListShareholderTransactionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Plus } from "lucide-react";

export default function Shareholders() {
  const queryClient = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [openTx, setOpenTx] = useState(false);
  const [form, setForm] = useState({ name: "", sharePercentage: "", shareCount: "", phone: "" });
  const [txForm, setTxForm] = useState({ shareholderId: "", type: "withdrawal", amount: "", transactionDate: new Date().toISOString().split("T")[0], notes: "" });

  const { data: shareholders, isLoading } = useListShareholders({ query: { queryKey: getListShareholdersQueryKey() } });
  const { data: transactions } = useListShareholderTransactions({}, { query: { queryKey: getListShareholderTransactionsQueryKey({}) } });
  const { mutate: create, isPending: creating } = useCreateShareholder({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListShareholdersQueryKey() }); setOpenNew(false); setForm({ name: "", sharePercentage: "", shareCount: "", phone: "" }); } } });
  const { mutate: createTx, isPending: creatingTx } = useCreateShareholderTransaction({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListShareholderTransactionsQueryKey({}) }); setOpenTx(false); } } });

  const totalWithdrawn = (shareholders ?? []).reduce((s, sh) => s + Number(sh.totalWithdrawn), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />شریکەکان
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenTx(true)} className="gap-2"><Plus className="h-4 w-4" />مامەڵەی دارایی</Button>
          <Button onClick={() => setOpenNew(true)} className="gap-2"><Plus className="h-4 w-4" />شریکی نوێ</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2 border-b bg-slate-50 dark:bg-slate-900/50">
          <CardTitle className="text-base">لیستی شریکەکان</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold w-8">ژ</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">ناو</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">مۆبایل</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">ژمارەی پشک</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">پارتنەری %</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">کۆی دەرکردراو</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : !shareholders?.length ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ شریکێک نەدۆزرایەوە</td></tr>
              ) : shareholders.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center text-slate-400">{i + 1}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-semibold">{s.name}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center" dir="ltr">{s.phone || "—"}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center font-bold text-indigo-700">{(s as any).shareCount ?? 0}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center font-bold text-primary">{s.sharePercentage}%</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold text-amber-600" dir="ltr">{formatMoney(s.totalWithdrawn)}</td>
                </tr>
              ))}
              {(shareholders?.length ?? 0) > 0 && (
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <td colSpan={5} className="border border-slate-300 dark:border-slate-600 px-3 py-2">کۆی گشتی</td>
                  <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left tabular-nums text-amber-700" dir="ltr">{formatMoney(totalWithdrawn)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {transactions && transactions.length > 0 && (
        <Card>
          <CardHeader className="pb-2 border-b bg-slate-50 dark:bg-slate-900/50">
            <CardTitle className="text-base">مامەڵەکانی دارایی</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">شریک</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">جۆر</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-left">بڕ</th>
                  <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">بەروار</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={t.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-medium">{t.shareholderName}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${t.type === "deposit" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {t.type === "deposit" ? "خستنەژوورەوە" : "دەرکردن"}
                      </span>
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(t.amount)}</td>
                    <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center tabular-nums" dir="ltr">{t.transactionDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>شریکی نوێ</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>ناو</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>ژمارەی پشک (لە کۆی ١٠٠)</Label>
              <Input type="number" step="1" value={form.shareCount} onChange={(e) => setForm({ ...form, shareCount: e.target.value })} placeholder="0" />
              <div className="text-xs text-slate-500 mt-1">ئەم ژمارەیە بۆ دابەشکردنی قازانج لە سندوقی گشتی بەکاردێت</div>
            </div>
            <div><Label>پارتنەری (%)</Label><Input type="number" step="0.01" value={form.sharePercentage} onChange={(e) => setForm({ ...form, sharePercentage: e.target.value })} placeholder="0.00" /></div>
            <div><Label>مۆبایل</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>هەڵوەشاندنەوە</Button>
            <Button onClick={() => { if (!form.name || !form.sharePercentage) return; create({ data: { name: form.name, sharePercentage: Number(form.sharePercentage), shareCount: form.shareCount ? Number(form.shareCount) : undefined, phone: form.phone || undefined } as any }); }} disabled={creating}>{creating ? "تۆمارکردن..." : "تۆمارکردن"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openTx} onOpenChange={setOpenTx}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>مامەڵەی دارایی شریک</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>شریک</Label>
              <select value={txForm.shareholderId} onChange={(e) => setTxForm({ ...txForm, shareholderId: e.target.value })} className="w-full border rounded px-3 py-2 mt-1 bg-white dark:bg-slate-900">
                <option value="">شریک هەڵبژێرە...</option>
                {shareholders?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label>جۆر</Label>
              <select value={txForm.type} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })} className="w-full border rounded px-3 py-2 mt-1 bg-white dark:bg-slate-900">
                <option value="withdrawal">دەرکردن</option>
                <option value="deposit">خستنەژوورەوە</option>
                <option value="profit">قازانج</option>
              </select>
            </div>
            <div><Label>بڕ (د.ع)</Label><Input type="number" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} /></div>
            <div><Label>بەروار</Label><Input type="date" value={txForm.transactionDate} onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenTx(false)}>هەڵوەشاندنەوە</Button>
            <Button onClick={() => { if (!txForm.shareholderId || !txForm.amount) return; createTx({ data: { shareholderId: Number(txForm.shareholderId), type: txForm.type, amount: Number(txForm.amount), transactionDate: txForm.transactionDate } }); }} disabled={creatingTx}>{creatingTx ? "تۆمارکردن..." : "تۆمارکردن"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
