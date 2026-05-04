import { useState } from "react";
import { Link } from "wouter";
import { useListSuppliers, useCreateSupplier, useDeleteSupplier, getListSuppliersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Truck, Plus, Trash2 } from "lucide-react";

export default function Suppliers() {
  const queryClient = useQueryClient();
  const { data: suppliers, isLoading } = useListSuppliers({}, { query: { queryKey: getListSuppliersQueryKey({}) } });
  const { mutate: create, isPending: creating } = useCreateSupplier({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey({}) }); setOpen(false); reset(); } } });
  const { mutate: del } = useDeleteSupplier({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListSuppliersQueryKey({}) }) } });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => { setName(""); setPhone(""); setPhone2(""); setAddress(""); setNotes(""); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Truck className="h-6 w-6 text-primary" />
          دابینکارەکان
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />زیادکردنی دابینکار</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>دابینکاری نوێ</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>ناو *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ناوی دابینکار..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>مۆبایل ١</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx..." dir="ltr" /></div>
                <div><Label>مۆبایل ٢</Label><Input value={phone2} onChange={(e) => setPhone2(e.target.value)} placeholder="07xx..." dir="ltr" /></div>
              </div>
              <div><Label>ناونیشان</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="ناونیشان..." /></div>
              <div><Label>تێبینی</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="تێبینی..." /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>پاشگەزبوونەوە</Button>
                <Button onClick={() => { if (!name) return; create({ data: { name, phone: phone || undefined, phone2: phone2 || undefined, address: address || undefined, notes: notes || undefined } }); }} disabled={creating || !name}>{creating ? "تۆمارکردن..." : "پاشەکەوتکردن"}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold w-20">کۆد</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold">ناوی دابینکار</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-center font-semibold">مۆبایل</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-left font-semibold">قەرزی ماوە</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-center font-semibold">دۆخ</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 w-14"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : !suppliers?.length ? (
                <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ دابینکارێک نەدۆزرایەوە</td></tr>
              ) : suppliers.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-500">S-{s.id.toString().padStart(4, "0")}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2">
                    <Link href={`/suppliers/${s.id}`} className="font-semibold text-primary hover:underline">{s.name}</Link>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center" dir="ltr">{s.phone || "—"}</td>
                  <td className={`border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold ${Number(s.totalDebt) > 0 ? "text-destructive" : "text-slate-400"}`} dir="ltr">{formatMoney(s.totalDebt)}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{s.isActive ? "چالاک" : "ناچالاک"}</span>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                    <button onClick={() => { if (confirm("دڵنیایت لە سڕینەوەی ئەم دابینکارە؟")) del({ id: s.id }); }} className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900 text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
