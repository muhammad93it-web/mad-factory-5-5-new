import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, getListEmployeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Pencil } from "lucide-react";

export default function Employees() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ code: "", name: "", role: "", phone: "", salary: "", hireDate: new Date().toISOString().split("T")[0], notes: "" });

  const { data: employees, isLoading } = useListEmployees({}, { query: { queryKey: getListEmployeesQueryKey({}) } });
  const { mutate: create, isPending: creating } = useCreateEmployee({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey({}) }); setOpen(false); } } });
  const { mutate: update, isPending: updating } = useUpdateEmployee({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey({}) }); setOpen(false); } } });

  const openNew = () => {
    setEditId(null);
    setForm({ code: `EMP-${String(Date.now()).slice(-4)}`, name: "", role: "", phone: "", salary: "", hireDate: new Date().toISOString().split("T")[0], notes: "" });
    setOpen(true);
  };

  const openEdit = (e: any) => {
    setEditId(e.id);
    setForm({ code: e.code, name: e.name, role: e.role ?? "", phone: e.phone ?? "", salary: String(e.salary), hireDate: e.hireDate ?? new Date().toISOString().split("T")[0], notes: e.notes ?? "" });
    setOpen(true);
  };

  const handleSubmit = () => {
    const data = { code: form.code, name: form.name, role: form.role || undefined, phone: form.phone || undefined, salary: Number(form.salary), hireDate: form.hireDate || undefined, notes: form.notes || undefined };
    if (editId) update({ id: editId, data }); else create({ data });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          کارمەندان
        </h1>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />کارمەندی نوێ</Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold">کۆد</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold">ناو</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold">پیشە</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-center font-semibold">مۆبایل</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-left font-semibold">مووچە</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-center font-semibold">دۆخ</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : !employees?.length ? (
                <tr><td colSpan={7} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ کارمەندێک نەدۆزرایەوە</td></tr>
              ) : employees.map((e, i) => (
                <tr key={e.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-500">{e.code}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-medium">{e.name}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2">{e.role || "—"}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center" dir="ltr">{e.phone || "—"}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{formatMoney(e.salary)}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${e.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{e.isActive ? "چالاک" : "ناچالاک"}</span>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editId ? "دەستکاریکردنی کارمەند" : "کارمەندی نوێ"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>کۆد</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>ناو</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>پیشە</Label><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
              <div><Label>مووبایل</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>مووچە (د.ع)</Label><Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
              <div><Label>بەرواری کارکردن</Label><Input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>هەڵوەشاندنەوە</Button>
            <Button onClick={handleSubmit} disabled={creating || updating}>{creating || updating ? "تۆمارکردن..." : "تۆمارکردن"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
