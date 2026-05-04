import { useState } from "react";
import {
  Download, Upload, Send, Settings2, Shield, Mail, MessageCircle,
  Eye, EyeOff, CheckCircle, AlertCircle, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiPost(path: string) {
  const r = await fetch(`${BASE}/api${path}`, { method: "POST", credentials: "include" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? "هەڵە ڕووی دا");
  return d as { message?: string };
}

export default function BackupPage() {
  const { data: settings, refetch } = useGetSettings({});
  const { mutate: updateSettings, isPending: saving } = useUpdateSettings({
    mutation: { onSuccess: () => { void refetch(); toast({ description: "ڕێکخستنەکان پاشەکەوت کران" }); } }
  });
  const { toast } = useToast();

  const [loading, setLoading] = useState<string | null>(null);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showTgToken, setShowTgToken] = useState(false);

  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [emailRecipient, setEmailRecipient] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");

  const loaded = !!settings;
  if (loaded && tgToken === "" && settings?.telegramBotToken) setTgToken(settings.telegramBotToken ?? "");
  if (loaded && tgChatId === "" && settings?.telegramChatId) setTgChatId(settings.telegramChatId ?? "");
  if (loaded && emailRecipient === "" && settings?.emailRecipient) setEmailRecipient(settings.emailRecipient ?? "");
  if (loaded && smtpHost === "" && settings?.emailSmtpHost) setSmtpHost(settings.emailSmtpHost ?? "");
  if (loaded && smtpPort === "587" && settings?.emailSmtpPort) setSmtpPort(settings.emailSmtpPort ?? "587");
  if (loaded && smtpUser === "" && settings?.emailSmtpUser) setSmtpUser(settings.emailSmtpUser ?? "");
  if (loaded && smtpPass === "" && settings?.emailSmtpPass) setSmtpPass(settings.emailSmtpPass ?? "");

  const handleDownload = async () => {
    setLoading("download");
    try {
      const r = await fetch(`${BASE}/api/backup/export`, { credentials: "include" });
      if (!r.ok) throw new Error("هەڵە");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mad-factory-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ description: "باکئەپ داگیرسا" });
    } catch {
      toast({ variant: "destructive", description: "هەڵە لە داگرتنی باکئەپ" });
    } finally {
      setLoading(null);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("دڵنیایت لە گەڕاندنەوەی داتا؟ هەموو داتای ئێستا لابردرێت!")) {
      e.target.value = "";
      return;
    }
    setLoading("restore");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`${BASE}/api/backup/restore`, { method: "POST", credentials: "include", body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((d as { error?: string }).error ?? "هەڵە");
      toast({ description: (d as { message?: string }).message ?? "باکئەپ گەڕایەوە" });
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "هەڵە ڕووی دا" });
    } finally {
      setLoading(null);
      e.target.value = "";
    }
  };

  const handleSendTelegram = async () => {
    setLoading("telegram");
    try {
      const d = await apiPost("/backup/send-telegram");
      toast({ description: d.message ?? "نێردرا" });
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "هەڵە ڕووی دا" });
    } finally {
      setLoading(null);
    }
  };

  const handleSendEmail = async () => {
    setLoading("email");
    try {
      const d = await apiPost("/backup/send-email");
      toast({ description: d.message ?? "نێردرا" });
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : "هەڵە ڕووی دا" });
    } finally {
      setLoading(null);
    }
  };

  const saveTelegram = () => {
    updateSettings({ data: { telegramBotToken: tgToken || null, telegramChatId: tgChatId || null } });
  };

  const saveEmail = () => {
    updateSettings({ data: {
      emailRecipient: emailRecipient || null,
      emailSmtpHost: smtpHost || null,
      emailSmtpPort: smtpPort || null,
      emailSmtpUser: smtpUser || null,
      emailSmtpPass: smtpPass || null,
    }});
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">باکئەپ و گەڕاندنەوە</h1>
      </div>

      {/* Manual Backup/Restore */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              داگرتنی باکئەپ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm text-slate-500">هەموو داتاکان بۆ فایلی JSON داگیردەکرێت.</p>
            <Button onClick={handleDownload} disabled={loading === "download"} className="w-full gap-2">
              <Download className="h-4 w-4" />
              {loading === "download" ? "دروستکردن..." : "داگرتنی باکئەپ"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-orange-500" />
              گەڕاندنەوەی باکئەپ
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">⚠️ ئەمە هەموو داتای ئێستا دەسڕێتەوە!</p>
            <label className="block">
              <input type="file" accept=".json" className="hidden" onChange={handleRestore} disabled={loading === "restore"} />
              <Button variant="outline" className="w-full gap-2 border-orange-200 hover:bg-orange-50" onClick={(e) => { (e.currentTarget.previousElementSibling as HTMLInputElement).click(); }} disabled={loading === "restore"}>
                <Upload className="h-4 w-4 text-orange-500" />
                {loading === "restore" ? "گەڕاندنەوە..." : "هەڵبژاردنی فایلی باکئەپ"}
              </Button>
            </label>
          </CardContent>
        </Card>
      </div>

      {/* Telegram Settings */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-blue-500" />
            ناردن بۆ تێلێگرام
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>تۆکنی بۆت (Bot Token)</Label>
              <div className="relative mt-1">
                <Input
                  type={showTgToken ? "text" : "password"}
                  value={tgToken}
                  onChange={(e) => setTgToken(e.target.value)}
                  placeholder="1234567890:ABC..."
                  className="pl-10"
                  dir="ltr"
                />
                <button type="button" onClick={() => setShowTgToken(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showTgToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">لە @BotFather وەرگرە</p>
            </div>
            <div>
              <Label>ئایدی چات (Chat ID)</Label>
              <Input value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="-100123456789" dir="ltr" className="mt-1" />
              <p className="text-xs text-slate-400 mt-1">ئایدی کانال یان گروپ</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveTelegram} disabled={saving} className="gap-2">
              <Settings2 className="h-4 w-4" />
              {saving ? "پاشەکەوتکردن..." : "پاشەکەوتکردنی ڕێکخستن"}
            </Button>
            <Button onClick={handleSendTelegram} disabled={loading === "telegram" || !tgToken || !tgChatId} className="gap-2">
              <Send className="h-4 w-4" />
              {loading === "telegram" ? "ناردن..." : "ناردنی باکئەپ بۆ تێلێگرام"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-green-500" />
            ناردن بۆ ئیمەیڵ
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div>
            <Label>ئیمەیڵی وەرگر</Label>
            <Input value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)} placeholder="example@gmail.com" dir="ltr" className="mt-1" type="email" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label>سێرڤەری SMTP</Label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" dir="ltr" className="mt-1" />
            </div>
            <div>
              <Label>پۆرت</Label>
              <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" dir="ltr" className="mt-1" type="number" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>ناوی بەکارهێنەری SMTP</Label>
              <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="your@gmail.com" dir="ltr" className="mt-1" type="email" />
            </div>
            <div>
              <Label>وشەی نهێنی SMTP</Label>
              <div className="relative mt-1">
                <Input
                  type={showSmtpPass ? "text" : "password"}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="وشەی نهێنی یان App Password"
                  className="pl-10"
                  dir="ltr"
                />
                <button type="button" onClick={() => setShowSmtpPass(v => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-xs text-slate-500 space-y-1">
            <p className="font-semibold text-slate-600 dark:text-slate-400">Gmail بۆ:</p>
            <p>SMTP: smtp.gmail.com | پۆرت: 587</p>
            <p>پێویستە App Password دروست بکەیت لە: myaccount.google.com/apppasswords</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveEmail} disabled={saving} className="gap-2">
              <Settings2 className="h-4 w-4" />
              {saving ? "پاشەکەوتکردن..." : "پاشەکەوتکردنی ڕێکخستن"}
            </Button>
            <Button onClick={handleSendEmail} disabled={loading === "email" || !emailRecipient || !smtpHost} className="gap-2">
              <Mail className="h-4 w-4" />
              {loading === "email" ? "ناردن..." : "ناردنی باکئەپ بۆ ئیمەیڵ"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
