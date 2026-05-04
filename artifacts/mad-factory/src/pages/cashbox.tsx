import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatMoney } from "@/lib/format";
import { useGetCashboxClosing } from "@workspace/api-client-react";
import { Banknote, Calendar, CalendarRange, AlertCircle } from "lucide-react";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ClosingView({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { data, isLoading } = useGetCashboxClosing(
    { fromDate, toDate },
    { query: { queryKey: ["cashboxClosing", fromDate, toDate] } }
  );

  if (isLoading || !data) {
    return <div className="text-center py-8 text-slate-500">چاوەڕێ بکە...</div>;
  }

  const s = data.sales!;
  const pi = data.purchasesIqd!;
  const pu = data.purchasesUsd!;
  const py = data.payroll!;
  const cmb = data.combined!;
  const r = data.result!;
  const sh = data.shareholders!;

  return (
    <div className="space-y-4">
      {/* ── 1. SALES (IQD) ──────────────────────────────────────── */}
      <SectionCard title="١) فرۆشتن (دینار)" color="emerald">
        <Row label="کۆی گشتی فرۆشتن" value={formatMoney(s.gross)} />
        <Row label="داشکاندن" value={formatMoney(s.discount)} negative />
        <Row label="پاش داشکاندن (تۆڕ)" value={formatMoney(s.net)} bold />
        <Row label="پارەی واصلکراو (نەختی)" value={formatMoney(s.cashReceivedCashVoucher)} />
        <Row label="پارەی واصلکراو (وەسڵی ناوخۆیی)" value={formatMoney(s.cashReceivedInternalVoucher)} />
        <Row label="کۆی واصلکراو" value={formatMoney(s.cashReceivedTotal)} bold />
        <Row label="باقی قەرزی کڕیار" value={formatMoney(s.debtRemaining)} warn />
      </SectionCard>

      {/* ── 2. PURCHASES IQD ────────────────────────────────────── */}
      <SectionCard title="٢) کڕین لە دابینکەران (دینار)" color="rose">
        <Row label="کۆی گشتی کڕین" value={formatMoney(pi.gross)} />
        <Row label="داشکاندن" value={formatMoney(pi.discount)} negative />
        <Row label="پاش داشکاندن (تۆڕ)" value={formatMoney(pi.net)} bold />
        <Row label="پارەی دراو (نەختی)" value={formatMoney(pi.cashPaidCashVoucher)} />
        <Row label="پارەی دراو (وەسڵی ناوخۆیی)" value={formatMoney(pi.cashPaidInternalVoucher)} />
        <Row label="کۆی دراو" value={formatMoney(pi.cashPaidTotal)} bold />
        <Row label="باقی قەرز بۆ دابینکەر" value={formatMoney(pi.debtRemaining)} warn />
      </SectionCard>

      {/* ── 3. PURCHASES USD ────────────────────────────────────── */}
      <SectionCard
        title={`٣) کڕین لە دابینکەران (دۆلار) — نرخی ئاڵوگۆڕ: ${formatMoney(pu.rate)}`}
        color="amber"
      >
        <Row label="کۆی گشتی کڕین ($)" value={`$${Number(pu.grossUsd).toLocaleString()}`} />
        <Row label="داشکاندن ($)" value={`$${Number(pu.discountUsd).toLocaleString()}`} negative />
        <Row label="پاش داشکاندن ($)" value={`$${Number(pu.netUsd).toLocaleString()}`} bold />
        <Row label="پاش داشکاندن (دینار)" value={formatMoney(pu.netIqd)} bold />
        <Row label="پارەی دراو (نەختی $)" value={`$${Number(pu.cashPaidCashVoucherUsd).toLocaleString()}`} />
        <Row label="پارەی دراو (وەسڵی ناوخۆیی $)" value={`$${Number(pu.cashPaidInternalVoucherUsd).toLocaleString()}`} />
        <Row label="کۆی دراو (دینار)" value={formatMoney(pu.cashPaidIqd)} bold />
        <Row label="باقی قەرز ($)" value={`$${Number(pu.debtRemainingUsd).toLocaleString()}`} warn />
        <Row label="باقی قەرز (دینار)" value={formatMoney(pu.debtRemainingIqd)} warn />
      </SectionCard>

      {/* ── 4. COMBINED EXPENSES + PAYROLL + OTHER ──────────────── */}
      <SectionCard title="٤) کۆی گشتی خەرجی (دینار)" color="slate">
        <Row label="کڕین (دینار)" value={formatMoney(pi.net)} />
        <Row label="کڕین (دۆلار → دینار)" value={formatMoney(pu.netIqd)} />
        <Row label="مووچە" value={formatMoney(py.due)} />
        <Row label="خەرجی گشتی" value={formatMoney(data.otherExpenses)} />
        <Row label="کۆی گشتی خەرجی" value={formatMoney(cmb.totalExpenses)} bold />
        <Row label="کۆی پارەی دراو" value={formatMoney(cmb.totalCashPaid)} />
        <Row label="کۆی قەرزی ماوە بۆ دابینکەر/کارمەند" value={formatMoney(cmb.totalDebtPayable)} warn />
      </SectionCard>

      {/* ── 5. RESULT ────────────────────────────────────────────── */}
      <Card className="border-2 border-primary">
        <CardContent className="pt-6 space-y-3">
          <h3 className="text-lg font-bold text-center text-primary">٥) ئەنجامی گشتی</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ResultBox
              label="قازانج / زیان"
              sub="فرۆش − خەرجی"
              value={Number(r.profit ?? 0)}
              isPositive={Number(r.profit ?? 0) >= 0}
            />
            <ResultBox
              label="جووڵەی نەختی"
              sub="واصلکراو − دراو"
              value={Number(r.cashFlow ?? 0)}
              isPositive={Number(r.cashFlow ?? 0) >= 0}
            />
            <ResultBox
              label="گۆڕانی قەرز"
              sub="قەرزی کڕیار − قەرزی دابینکەر"
              value={Number(r.netDebtChange ?? 0)}
              isPositive={Number(r.netDebtChange ?? 0) >= 0}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── 6. SHAREHOLDERS ─────────────────────────────────────── */}
      <SectionCard title="٦) دابەشکردنی قازانج لەسەر شەریکەکان" color="indigo">
        <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">
          کۆی پشک: {sh.totalShares} • قازانجی هەر پشکێک: {formatMoney(sh.perShareValue)}
        </div>
        {sh.breakdown && sh.breakdown.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="text-right p-2">شەریک</th>
                <th className="text-center p-2">ژمارەی پشک</th>
                <th className="text-center p-2">ڕێژە %</th>
                <th className="text-left p-2">بەشی قازانج</th>
              </tr>
            </thead>
            <tbody>
              {sh.breakdown.map((b: any) => (
                <tr key={b.id} className="border-t">
                  <td className="text-right p-2">{b.name}</td>
                  <td className="text-center p-2">{b.shareCount}</td>
                  <td className="text-center p-2">{Number(b.sharePercentage).toFixed(2)}%</td>
                  <td className="text-left p-2 font-mono font-bold">{formatMoney(b.profitShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              هیچ شەریکێک تۆمارنەکراوە. لە پەڕەی شەریکەکان شەریک زیاد بکە و ژمارەی پشکی هەریەکیان دیاری بکە.
            </AlertDescription>
          </Alert>
        )}
      </SectionCard>
    </div>
  );
}

function SectionCard({
  title,
  color,
  children,
}: {
  title: string;
  color: "emerald" | "rose" | "amber" | "slate" | "indigo";
  children: React.ReactNode;
}) {
  const colorMap = {
    emerald: "border-r-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/10",
    rose: "border-r-rose-500 bg-rose-50/40 dark:bg-rose-950/10",
    amber: "border-r-amber-500 bg-amber-50/40 dark:bg-amber-950/10",
    slate: "border-r-slate-500 bg-slate-50/40 dark:bg-slate-900/20",
    indigo: "border-r-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/10",
  };
  return (
    <Card className={`border-r-4 ${colorMap[color]}`}>
      <CardContent className="pt-4">
        <h3 className="font-bold mb-3 text-slate-800 dark:text-slate-100">{title}</h3>
        <div className="space-y-1">{children}</div>
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
  negative,
  warn,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-1.5 px-2 rounded ${
        bold ? "bg-white dark:bg-slate-800 font-bold" : ""
      }`}
    >
      <span className="text-slate-700 dark:text-slate-200">{label}</span>
      <span
        className={`font-mono ${
          negative ? "text-rose-600" : warn ? "text-amber-700" : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ResultBox({
  label,
  sub,
  value,
  isPositive,
}: {
  label: string;
  sub: string;
  value: number;
  isPositive: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-lg text-center ${
        isPositive ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-rose-50 dark:bg-rose-950/30"
      }`}
    >
      <div className="text-sm text-slate-600 dark:text-slate-300">{label}</div>
      <div className="text-xs text-slate-500 mb-2">{sub}</div>
      <div
        className={`text-2xl font-bold font-mono ${
          isPositive ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
        }`}
      >
        {formatMoney(value)}
      </div>
    </div>
  );
}

export default function Cashbox() {
  const [dailyDate, setDailyDate] = useState<string>(todayIso());
  const [rangeFrom, setRangeFrom] = useState<string>(todayIso().slice(0, 7) + "-01");
  const [rangeTo, setRangeTo] = useState<string>(todayIso());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Banknote className="h-6 w-6 text-primary" />
          سندوقی گشتی — داخستنی ڕۆژانە و ماوەیی
        </h1>
      </div>

      <Tabs defaultValue="daily" dir="rtl">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" /> ڕۆژانە
          </TabsTrigger>
          <TabsTrigger value="range" className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4" /> ماوە
          </TabsTrigger>
        </TabsList>

        {/* ── DAILY TAB ─────────────────────────────────────────── */}
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardContent className="pt-4 flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label>ڕۆژ</Label>
                <Input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="text-sm text-slate-500 self-center">
                داخستنی سندوقی ئەو ڕۆژە تەنها
              </div>
            </CardContent>
          </Card>
          <ClosingView fromDate={dailyDate} toDate={dailyDate} />
        </TabsContent>

        {/* ── RANGE TAB ─────────────────────────────────────────── */}
        <TabsContent value="range" className="space-y-4">
          <Card>
            <CardContent className="pt-4 flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label>لە ڕۆژی</Label>
                <Input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="space-y-1">
                <Label>تا ڕۆژی</Label>
                <Input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="text-sm text-slate-500 self-center">
                کۆکردنەوەی هەموو ئەو ماوەیە
              </div>
            </CardContent>
          </Card>
          <ClosingView fromDate={rangeFrom} toDate={rangeTo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
