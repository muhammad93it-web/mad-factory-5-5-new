import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  useListPurchaseInvoices,
  getListPurchaseInvoicesQueryKey,
  useListSuppliers,
  getListSuppliersQueryKey,
  getPurchaseInvoice,
  getGetPurchaseInvoiceQueryKey,
} from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { ArrowRight, Printer, FileText, Search, Truck } from "lucide-react";
import { PrintStyles } from "@/components/print-styles";

type FlatItem = {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  materialName: string;
  quantity: number;
  palletCount: number | null;
  unitPrice: number;
  total: number;
};

export default function PurchasesConsolidated() {
  const [, navigate] = useLocation();
  const [supplierId, setSupplierId] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");
  const [generated, setGenerated] = useState(false);

  const { data: suppliers } = useListSuppliers({}, { query: { queryKey: getListSuppliersQueryKey({}) } });

  const listParams: {
    supplierId?: number;
    fromDate?: string;
    toDate?: string;
    currency?: "USD" | "IQD";
  } = {
    supplierId: supplierId ? Number(supplierId) : undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    currency: currency === "USD" || currency === "IQD" ? currency : undefined,
  };
  const { data: invoices, isLoading } = useListPurchaseInvoices(listParams, {
    query: {
      queryKey: getListPurchaseInvoicesQueryKey(listParams),
      enabled: generated && !!supplierId,
    },
  });

  const detailQueries = useQueries({
    queries: (invoices ?? []).map((inv) => ({
      queryKey: getGetPurchaseInvoiceQueryKey(inv.id),
      queryFn: () => getPurchaseInvoice(inv.id),
      enabled: generated && !!supplierId,
    })),
  });

  const allLoaded = detailQueries.length > 0 && detailQueries.every((q) => q.data && !q.isLoading);

  const flat: FlatItem[] = useMemo(() => {
    if (!allLoaded) return [];
    const out: FlatItem[] = [];
    detailQueries.forEach((q) => {
      const inv = q.data as
        | {
            id: number;
            invoiceNumber: string;
            invoiceDate: string;
            currency: string;
            items: Array<{
              materialName: string;
              quantity: number;
              palletCount: number | null;
              unitPrice: number;
              total: number;
            }>;
          }
        | undefined;
      if (!inv) return;
      inv.items.forEach((it) => {
        out.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: inv.invoiceDate,
          currency: inv.currency,
          materialName: it.materialName,
          quantity: it.quantity,
          palletCount: it.palletCount,
          unitPrice: it.unitPrice,
          total: it.total,
        });
      });
    });
    return out;
  }, [allLoaded, detailQueries]);

  // Multi-currency totals
  const totalsByCurrency = useMemo(() => {
    const acc: Record<string, { total: number; paid: number; debt: number; totalIqd: number; paidIqd: number; debtIqd: number }> = {};
    (invoices ?? []).forEach((i) => {
      const key = i.currency;
      if (!acc[key]) acc[key] = { total: 0, paid: 0, debt: 0, totalIqd: 0, paidIqd: 0, debtIqd: 0 };
      acc[key].total += Number(i.total);
      acc[key].paid += Number(i.paidAmount);
      acc[key].debt += Number(i.remainingDebt);
      acc[key].totalIqd += Number(i.totalIqd);
      acc[key].paidIqd += Number(i.paidAmountIqd);
      acc[key].debtIqd += Number(i.remainingDebtIqd);
    });
    return acc;
  }, [invoices]);

  const supplier = suppliers?.find((s) => String(s.id) === supplierId);

  return (
    <div className="space-y-4">
      <PrintStyles />

      <div className="flex items-center justify-between print:hidden">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          پسووڵەی یەکگرتووی کڕین
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/purchases")} className="gap-2">
            <ArrowRight className="h-4 w-4" /> گەڕانەوە
          </Button>
          {generated && allLoaded && flat.length > 0 && (
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer className="h-4 w-4" /> چاپکردن
            </Button>
          )}
        </div>
      </div>

      <Card className="print:hidden">
        <CardHeader className="pb-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">فلتەرکردن</div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">دابینکار *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="هەڵبژاردنی دابینکار" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">دراو</Label>
              <Select value={currency || "all"} onValueChange={(v) => setCurrency(v === "all" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">هەموو</SelectItem>
                  <SelectItem value="IQD">دینار</SelectItem>
                  <SelectItem value="USD">دۆلار</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">لە بەرواری</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">بۆ بەرواری</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button
              onClick={() => setGenerated(true)}
              disabled={!supplierId}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              <Search className="h-4 w-4" /> ئامادەکردن
            </Button>
          </div>
        </CardContent>
      </Card>

      {generated && !supplierId && (
        <div className="text-center text-slate-500 p-6">تکایە دابینکارێک هەڵبژێرە</div>
      )}

      {generated && supplierId && isLoading && (
        <div className="text-center text-slate-500 p-6">بەڕێکردنی پسووڵەکان...</div>
      )}

      {generated && supplierId && !isLoading && (invoices?.length ?? 0) === 0 && (
        <div className="text-center text-slate-500 p-6 border border-dashed rounded-lg">
          هیچ پسووڵەیەک نەدۆزرایەوە لەم ماوەیەدا
        </div>
      )}

      {generated && supplierId && (invoices?.length ?? 0) > 0 && !allLoaded && (
        <div className="text-center text-slate-500 p-6">بەڕێکردنی بڕگەکان...</div>
      )}

      {generated && allLoaded && flat.length > 0 && (
        <div className="print-area bg-white border-2 border-slate-300 rounded-lg overflow-hidden text-slate-900" dir="rtl">
          <div className="bg-white border-b-4 border-red-700">
            <div className="flex items-stretch">
              <div className="w-44 bg-white border-l-2 border-red-700 p-2 flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-red-700 rounded-md flex items-center justify-center text-white font-bold text-xs text-center leading-tight">
                  MAD<br />BRICK
                </div>
                <div className="text-[10px] text-red-700 font-bold mt-1">معمل طابوق ماد</div>
                <div className="text-[9px] text-slate-500 mt-0.5" dir="ltr">0771 153 3480</div>
                <div className="text-[9px] text-slate-500" dir="ltr">0785 153 3480</div>
              </div>
              <div className="flex-1 bg-red-700 text-white py-3 px-4 flex flex-col items-center justify-center">
                <div className="text-2xl font-extrabold flex items-center gap-2">
                  <Truck className="h-6 w-6" />
                  معمل طابوق ماد / کارگەی خشتی ماد
                </div>
                <div className="text-sm mt-1 opacity-90">پسووڵەی یەکگرتووی کڕین — کۆکراوەی چەند پسووڵەیەک</div>
              </div>
            </div>
            <div className="flex items-center justify-between bg-white px-4 py-1.5 text-xs border-t border-red-700">
              <div className="font-medium" dir="ltr">07851533480 - 07701533480 - 07511533480 :مۆبایل</div>
              <div className="font-medium">عنوان: ڕێگای جەمجەماڵ - سلێمانی</div>
            </div>
          </div>

          <div className="border-b border-slate-300">
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 w-32 text-right">ناوی دابینکار</th>
                  <td className="border border-slate-300 px-2 py-1.5 font-bold" colSpan={3}>{supplier?.name ?? "—"}</td>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 w-24 text-right">کۆد</th>
                  <td className="border border-slate-300 px-2 py-1.5 font-mono" dir="ltr">S-{(supplier?.id ?? 0).toString().padStart(4, "0")}</td>
                </tr>
                <tr>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">مۆبایل</th>
                  <td className="border border-slate-300 px-2 py-1.5" dir="ltr">{supplier?.phone || "—"}</td>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 w-20 text-right">لە بەرواری</th>
                  <td className="border border-slate-300 px-2 py-1.5" dir="ltr">{fromDate ? formatDate(fromDate) : "—"}</td>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 w-20 text-right">بۆ بەرواری</th>
                  <td className="border border-slate-300 px-2 py-1.5" dir="ltr">{toDate ? formatDate(toDate) : "—"}</td>
                </tr>
                <tr>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">ژمارەی پسووڵە</th>
                  <td className="border border-slate-300 px-2 py-1.5 font-bold" dir="ltr">{invoices?.length ?? 0}</td>
                  <th className="bg-slate-100 border border-slate-300 px-2 py-1.5 text-right">کۆی بڕگە</th>
                  <td className="border border-slate-300 px-2 py-1.5 font-bold" dir="ltr" colSpan={3}>{flat.length}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="p-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-emerald-100 text-slate-800 text-xs">
                  <th className="border border-slate-300 px-2 py-2 w-10">ژ</th>
                  <th className="border border-slate-300 px-2 py-2 w-24">ژ.پسووڵە</th>
                  <th className="border border-slate-300 px-2 py-2 w-24">بەروار</th>
                  <th className="border border-slate-300 px-2 py-2">ناوی شت</th>
                  <th className="border border-slate-300 px-2 py-2 w-20">بڕ</th>
                  <th className="border border-slate-300 px-2 py-2 w-20">پاڵەت</th>
                  <th className="border border-slate-300 px-2 py-2 w-16">دراو</th>
                  <th className="border border-slate-300 px-2 py-2 w-24">نرخی یەک</th>
                  <th className="border border-slate-300 px-2 py-2 w-28">کۆی گشتی</th>
                </tr>
              </thead>
              <tbody>
                {flat.map((it, i) => (
                  <tr key={`${it.invoiceId}-${i}`}>
                    <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-500">{i + 1}</td>
                    <td className="border border-slate-300 px-2 py-1.5 font-mono text-xs" dir="ltr">{it.invoiceNumber}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center" dir="ltr">{formatDate(it.invoiceDate)}</td>
                    <td className="border border-slate-300 px-2 py-1.5 font-medium">{it.materialName}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">{it.quantity.toLocaleString()}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums">{it.palletCount?.toLocaleString() ?? "—"}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center text-xs">{it.currency}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums" dir="ltr">{it.unitPrice.toLocaleString()}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums font-bold" dir="ltr">{it.total.toLocaleString()} {it.currency === "USD" ? "$" : "د.ع"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-2 pb-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 text-xs text-slate-600 pt-2">
                <div className="font-bold text-slate-700">تێبینی:</div>
                <div className="border border-dashed border-slate-300 rounded p-2 min-h-[80px] bg-slate-50">
                  ئەم پسووڵە یەکگرتووە بریتییە لە کۆی {invoices?.length ?? 0} پسووڵەی کڕین لەنێوان بەرواری {fromDate ? formatDate(fromDate) : "..."} و {toDate ? formatDate(toDate) : "..."}.
                </div>
              </div>
              <div className="space-y-1.5">
                {Object.entries(totalsByCurrency).map(([cur, t]) => (
                  <div key={cur} className="border border-slate-300 rounded overflow-hidden">
                    <div className="bg-slate-200 px-3 py-1 text-sm font-bold text-center">دراو: {cur}</div>
                    <div className="grid grid-cols-2 gap-0">
                      <div className="bg-blue-100 border-t border-slate-300 px-3 py-2 text-sm font-bold text-right">کۆی کڕین</div>
                      <div className="border-t border-slate-300 px-3 py-2 text-left tabular-nums font-bold" dir="ltr">{t.total.toLocaleString()} {cur === "USD" ? "$" : "د.ع"}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-0">
                      <div className="bg-emerald-100 border-t border-slate-300 px-3 py-2 text-sm font-bold text-right">کۆی پارەدان</div>
                      <div className="border-t border-slate-300 px-3 py-2 text-left tabular-nums font-bold text-emerald-700" dir="ltr">{t.paid.toLocaleString()} {cur === "USD" ? "$" : "د.ع"}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-0">
                      <div className="bg-red-100 border-t border-slate-300 px-3 py-2 text-sm font-bold text-right">باقی قەرز (د.ع)</div>
                      <div className={`border-t border-slate-300 px-3 py-2 text-left tabular-nums font-bold ${t.debtIqd > 0 ? "text-red-700" : "text-emerald-700"}`} dir="ltr">{t.debtIqd.toLocaleString()} د.ع</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-8 mt-8 pt-4 text-xs text-slate-600">
              <div className="text-center"><div className="border-t border-slate-400 pt-1.5">واژۆی کڕیار</div></div>
              <div className="text-center"><div className="border-t border-slate-400 pt-1.5">واژۆی بەڕێوەبەر</div></div>
              <div className="text-center"><div className="border-t border-slate-400 pt-1.5">واژۆی دابینکار</div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
