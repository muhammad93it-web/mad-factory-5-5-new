import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useGetSettings,
  useUpdateSettings,
  useGetLatestExchangeRate,
  useCreateExchangeRate,
  getGetLatestExchangeRateQueryKey,
  getGetSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, DollarSign, Save, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const { data: latestRate } = useGetLatestExchangeRate({ query: { queryKey: getGetLatestExchangeRateQueryKey() } });

  const [form, setForm] = useState({ factoryName: "", factoryNameKu: "", phone: "", address: "" });
  const [rateDate, setRateDate] = useState(new Date().toISOString().split("T")[0]);
  const [rate, setRate] = useState("");
  const [pinForm, setPinForm] = useState({ deletePin: "", confirmPin: "" });
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({ factoryName: settings.factoryName, factoryNameKu: settings.factoryNameKu, phone: settings.phone ?? "", address: settings.address ?? "" });
    }
  }, [settings]);

  const { mutate: updateSettings, isPending: saving } = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: "ڕێکخستنەکان پاشەکەوتکرا" });
      },
    },
  });
  const { mutate: createRate, isPending: savingRate } = useCreateExchangeRate({
    mutation: {
      onSuccess: async (saved) => {
        // Seed cache directly from the server response so header
        // updates instantly, then invalidate to keep things in sync.
        if (saved) {
          queryClient.setQueryData(getGetLatestExchangeRateQueryKey(), saved);
        }
        await queryClient.invalidateQueries({ queryKey: getGetLatestExchangeRateQueryKey() });
        toast({ title: "نرخی دۆلار نوێکرایەوە" });
        setRate("");
      },
    },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <SettingsIcon className="h-6 w-6 text-primary" />
        ڕێکخستنەکان
      </h1>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            نرخی دۆلار
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {latestRate && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded p-3 flex justify-between items-center">
              <span className="text-slate-600">نرخی ئێستا:</span>
              <span className="font-bold text-lg" dir="ltr">1 USD = {latestRate.rate.toLocaleString()} IQD</span>
            </div>
          )}
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>نرخی نوێ (IQD)</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ب.نم: 1480" />
            </div>
            <div className="flex-1">
              <Label>بەروار</Label>
              <Input type="date" value={rateDate} onChange={(e) => setRateDate(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => {
            if (!rate) return;
            createRate({ data: { rate: Number(rate), rateDate } });
          }} disabled={savingRate} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {savingRate ? "پاشەکەوتکردن..." : "پاشەکەوتکردنی نرخ"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-primary" />
            زانیاری کارگە
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>ناوی کارگە (کوردی)</Label><Input value={form.factoryNameKu} onChange={(e) => setForm({ ...form, factoryNameKu: e.target.value })} /></div>
            <div><Label>ناوی کارگە (ئینگلیزی)</Label><Input value={form.factoryName} onChange={(e) => setForm({ ...form, factoryName: e.target.value })} dir="ltr" /></div>
          </div>
          <div><Label>تەلەفۆن</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" /></div>
          <div><Label>ناونیشان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <Button onClick={() => updateSettings({ data: form })} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? "پاشەکەوتکردن..." : "پاشەکەوتکردنی زانیاری"}
          </Button>
        </CardContent>
      </Card>

      {/* Master delete PIN */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-rose-600" />
            ژمارەی نهێنی بۆ سڕینەوە
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-md p-3 text-sm text-rose-800 dark:text-rose-200">
            ئەم ژمارە نهێنییە لە کاتی سڕینەوەی هەر ڕیزێک لە پسووڵەکان داوا دەکرێت. بنەڕەتی: <span dir="ltr" className="font-mono font-bold">0000</span>
          </div>
          <div>
            <Label>ژمارەی نهێنی نوێ</Label>
            <div className="flex gap-2">
              <Input
                type={showPin ? "text" : "password"}
                value={pinForm.deletePin}
                onChange={(e) => setPinForm({ ...pinForm, deletePin: e.target.value })}
                placeholder="••••"
                dir="ltr"
                className="font-mono tracking-widest"
                maxLength={12}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowPin((v) => !v)} title={showPin ? "شاردنەوە" : "نیشاندان"}>
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label>دووبارەکردنەوە</Label>
            <Input
              type={showPin ? "text" : "password"}
              value={pinForm.confirmPin}
              onChange={(e) => setPinForm({ ...pinForm, confirmPin: e.target.value })}
              placeholder="••••"
              dir="ltr"
              className="font-mono tracking-widest"
              maxLength={12}
            />
          </div>
          <Button
            onClick={() => {
              if (!pinForm.deletePin || pinForm.deletePin.length < 3) {
                toast({ title: "ژمارەی نهێنی پێویستە لانیکەم ٣ ژمارە بێت", variant: "destructive" });
                return;
              }
              if (pinForm.deletePin !== pinForm.confirmPin) {
                toast({ title: "ژمارە نهێنییەکان یەکسان نین", variant: "destructive" });
                return;
              }
              updateSettings(
                { data: { deletePin: pinForm.deletePin } },
                {
                  onSuccess: () => {
                    setPinForm({ deletePin: "", confirmPin: "" });
                    toast({ title: "ژمارەی نهێنی نوێکرایەوە" });
                  },
                },
              );
            }}
            disabled={saving}
            className="w-full gap-2 bg-rose-600 hover:bg-rose-700"
          >
            <Lock className="h-4 w-4" />
            پاشەکەوتکردنی ژمارەی نهێنی
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
