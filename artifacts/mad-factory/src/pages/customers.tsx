import { useState } from "react";
import { Link } from "wouter";
import { useListCustomers, getListCustomersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { Search, UserCircle } from "lucide-react";
import { QuickAddParty } from "@/components/quick-add-party";

export default function Customers() {
  const [search, setSearch] = useState("");
  const { data: customers, isLoading } = useListCustomers(
    { search: search || undefined },
    { query: { queryKey: getListCustomersQueryKey({ search: search || undefined }) } }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <UserCircle className="h-6 w-6 text-primary" />
          لیستی کڕیارەکان
        </h1>
        <QuickAddParty kind="customer" buttonLabel="زیادکردنی کڕیار" buttonVariant="default" buttonSize="default" buttonClassName="bg-primary hover:bg-primary/90 text-white gap-2" />
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="گەڕان بەدوای کڕیار..." className="pl-3 pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold w-20">کۆد</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-right font-semibold">ناوی کڕیار</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-center font-semibold">مۆبایل</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-left font-semibold">قەرزی ماوە</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-center font-semibold">دۆخ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : customers?.length === 0 ? (
                <tr><td colSpan={5} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ کڕیارێک نەدۆزرایەوە</td></tr>
              ) : customers?.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 font-mono text-slate-500">C-{c.id.toString().padStart(4, "0")}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2">
                    <Link href={`/customers/${c.id}`} className="font-semibold text-primary hover:underline">{c.name}</Link>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center" dir="ltr">{c.phone || "—"}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-left tabular-nums font-bold text-destructive" dir="ltr">{formatMoney(c.totalDebt)}</td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${c.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-800"}`}>
                      {c.isActive ? "چالاک" : "ناچالاک"}
                    </span>
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
