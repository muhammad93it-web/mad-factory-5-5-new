import { useState } from "react";
import { Users, Plus, Trash2, Edit2, Eye, EyeOff, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type AppUser = { id: number; username: string; role: string; permissions: string[]; isActive: boolean; createdAt: string };

const ALL_PERMISSIONS: { slug: string; label: string }[] = [
  { slug: "dashboard", label: "داشبۆرد" }, { slug: "sales", label: "فرۆشتن" }, { slug: "purchases", label: "کڕین" },
  { slug: "customers", label: "کڕیارەکان" }, { slug: "suppliers", label: "دابینکارەکان" }, { slug: "materials", label: "کەرەستەکان" },
  { slug: "employees", label: "کارمەندان" }, { slug: "payroll", label: "مووچە" }, { slug: "expenses", label: "خەرجیەکان" },
  { slug: "incomes", label: "داهاتەکان" }, { slug: "shareholders", label: "شریکەکان" }, { slug: "cashbox", label: "خەزینە" },
  { slug: "reports", label: "ڕاپۆرتەکان" }, { slug: "alerts", label: "ئاگادارکردنەوەکان" }, { slug: "settings", label: "ڕێکخستنەکان" },
];

async function apiCall(path: string, method = "GET", body?: object) {
  const r = await fetch(`${BASE}/api${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error((d as { error?: string }).error ?? "هەڵە ڕووی دا"); }
  return r.json();
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppUser | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [perms, setPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = async () => { const data = await apiCall("/users"); setUsers(data as AppUser[]); setLoaded(true); };
  if (!loaded) loadUsers().catch(() => setLoaded(true));

  const openCreate = () => { setEditTarget(null); setUsername(""); setPassword(""); setShowPass(false); setRole("employee"); setPerms([]); setError(""); setOpen(true); };
  const openEdit = (u: AppUser) => { setEditTarget(u); setUsername(u.username); setPassword(""); setShowPass(false); setRole(u.role === "admin" ? "admin" : "employee"); setPerms(u.permissions); setError(""); setOpen(true); };
  const togglePerm = (slug: string) => setPerms((prev) => prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]);

  const handleSave = async () => {
    if (!username) { setError("ناوی بەکارهێنەر پێویستە"); return; }
    if (!editTarget && !password) { setError("وشەی نهێنی پێویستە"); return; }
    setSaving(true); setError("");
    try {
      if (editTarget) { const body: Record<string, unknown> = { username, role, permissions: perms }; if (password) body.password = password; await apiCall(`/users/${editTarget.id}`, "PUT", body); }
      else await apiCall("/users", "POST", { username, password, role, permissions: perms });
      setOpen(false); setLoaded(false);
    } catch (err) { setError(err instanceof Error ? err.message : "هەڵە ڕووی دا"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (id === me?.id) { alert("ناتوانیت هەژمارەکەی خۆت بسڕیتەوە"); return; }
    if (!confirm("دڵنیایت لە سڕینەوەی ئەم بەکارهێنەرە؟")) return;
    await apiCall(`/users/${id}`, "DELETE"); setLoaded(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><Users className="h-6 w-6 text-primary" />بەڕێوەبردنی بەکارهێنەران</h1>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />بەکارهێنەری نوێ</Button>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base">لیستی بەکارهێنەران</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">ناوی بەکارهێنەر</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">ڕۆڵ</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold">دەسەڵاتەکان</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center">دۆخ</th>
                <th className="border border-slate-300 dark:border-slate-600 px-3 py-2.5 font-semibold text-center w-24">کارەکان</th>
              </tr>
            </thead>
            <tbody>
              {!users.length ? (
                <tr><td colSpan={5} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : users.map((u, i) => (
                <tr key={u.id} className={i % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50 dark:bg-slate-900"}>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2">
                    <div className="flex items-center gap-2 font-semibold">
                      {u.role === "admin" ? <ShieldCheck className="h-4 w-4 text-primary shrink-0" /> : <User className="h-4 w-4 text-slate-400 shrink-0" />}
                      {u.username}
                      {u.id === me?.id && <span className="text-[10px] text-slate-400">(تۆ)</span>}
                    </div>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center">
                    <Badge variant={u.role === "admin" ? "default" : "secondary"}>{u.role === "admin" ? "بەڕێوەبەر" : "کارمەند"}</Badge>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2">
                    {u.role === "admin" ? <span className="text-xs text-slate-500">هەموو دەسەڵاتەکان</span> : (
                      <div className="flex flex-wrap gap-1">
                        {u.permissions.length === 0 ? <span className="text-xs text-slate-400">هیچ دەسەڵاتێک نییە</span>
                          : u.permissions.map((p) => <Badge key={p} variant="outline" className="text-[10px]">{ALL_PERMISSIONS.find((x) => x.slug === p)?.label ?? p}</Badge>)}
                      </div>
                    )}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-3 py-2 text-center">
                    <Badge variant={u.isActive ? "default" : "destructive"}>{u.isActive ? "چالاک" : "ناچالاک"}</Badge>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(u)} className="inline-flex items-center justify-center p-1.5 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-100 transition-colors">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {u.id !== me?.id && (
                        <button onClick={() => handleDelete(u.id)} className="inline-flex items-center justify-center p-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle>{editTarget ? "گۆڕینی بەکارهێنەر" : "بەکارهێنەری نوێ"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>ناوی بەکارهێنەر *</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" dir="ltr" /></div>
            <div>
              <Label>{editTarget ? "وشەی نهێنی (بەتاڵ بهێڵە ئەگەر ناتەوێت بگۆڕیت)" : "وشەی نهێنی *"}</Label>
              <div className="relative mt-1">
                <Input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="وشەی نهێنی..." className="pl-10" dir="ltr" />
                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>ڕۆڵ</Label>
              <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "employee")} className="w-full border rounded px-3 py-2 bg-white dark:bg-slate-900 mt-1">
                <option value="employee">کارمەند (بەکارهێنەر)</option>
                <option value="admin">بەڕێوەبەر (هەموو دەسەڵاتەکان)</option>
              </select>
            </div>
            {role === "employee" && (
              <div>
                <Label className="mb-2 block">دەسەڵاتەکان</Label>
                <div className="border rounded-lg p-3 space-y-2 max-h-52 overflow-y-auto">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-primary">
                    <input type="checkbox" checked={perms.length === ALL_PERMISSIONS.length} onChange={(e) => setPerms(e.target.checked ? ALL_PERMISSIONS.map((p) => p.slug) : [])} />
                    هەموو بەشەکان
                  </label>
                  <hr />
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p.slug} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={perms.includes(p.slug)} onChange={() => togglePerm(p.slug)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {error && <div className="bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-600">{error}</div>}
            <div className="flex justify-start gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving}>{saving ? "تۆمارکردن..." : "پاشەکەوتکردن"}</Button>
              <Button variant="outline" onClick={() => setOpen(false)}>پاشگەزبوونەوە</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
