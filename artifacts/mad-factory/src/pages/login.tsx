import { useEffect, useState } from "react";
import { Factory, Eye, EyeOff, Lock, User, ChevronDown, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type PublicUser = { id: number; username: string; role: "admin" | "employee" };

export default function LoginPage() {
  const { login } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${BASE}/api/auth/users`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PublicUser[]) => {
        setUsers(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) {
          const admin = data.find((u) => u.role === "admin");
          setSelected(admin ?? data[0] ?? null);
        }
      })
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError("تکایە بەکارهێنەرێک هەڵبژێرە");
      return;
    }
    if (!password) {
      setError("تکایە وشەی نهێنی بنووسە");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(selected.username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "هەڵە ڕووی دا");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-bl from-slate-900 via-primary/90 to-slate-900 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent/20 rounded-2xl ring-2 ring-accent/30 mb-4">
            <Factory className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-white">کارگەی خشتی ماد</h1>
          <p className="text-slate-400 text-sm mt-1">سیستەمی بەڕێوەبردنی کارگە</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 space-y-5"
        >
          <h2 className="text-lg font-bold text-slate-800 dark:text-white text-center">
            چوونەژوورەوە
          </h2>

          {/* User picker */}
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">بەکارهێنەر</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={loading || usersLoading || users.length === 0}
                  className="w-full h-10 flex items-center justify-between px-3 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm hover:bg-slate-50 dark:hover:bg-slate-900 disabled:opacity-50"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <User className="h-4 w-4 text-slate-500 shrink-0" />
                    <span
                      className={`truncate ${selected ? "font-semibold text-slate-900 dark:text-slate-50" : "text-slate-400"}`}
                    >
                      {usersLoading
                        ? "بارکردن..."
                        : selected
                          ? selected.username
                          : users.length === 0
                            ? "هیچ بەکارهێنەرێک نەدۆزرایەوە"
                            : "هەڵبژێرە..."}
                    </span>
                    {selected?.role === "admin" && (
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="p-1 w-[calc(var(--radix-popover-trigger-width))]"
                align="start"
                dir="rtl"
              >
                <div className="max-h-64 overflow-y-auto">
                  {users.map((u) => {
                    const isSelected = selected?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setSelected(u);
                          setPickerOpen(false);
                          setError("");
                        }}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded text-sm cursor-pointer text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Check
                          className={`h-4 w-4 text-emerald-600 dark:text-emerald-400 ${isSelected ? "opacity-100" : "opacity-0"}`}
                        />
                        <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span className="flex-1 text-right font-medium truncate">
                          {u.username}
                        </span>
                        {u.role === "admin" && (
                          <span className="text-[10px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
                            بەڕێوەبەر
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label className="text-slate-700 dark:text-slate-300">وشەی نهێنی</Label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="وشەی نهێنی..."
                className="pr-10 pl-10"
                autoComplete="current-password"
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading || !selected}>
            {loading ? "چوونەژوورەوە..." : "چوونەژوورەوە"}
          </Button>
        </form>
      </div>
    </div>
  );
}
