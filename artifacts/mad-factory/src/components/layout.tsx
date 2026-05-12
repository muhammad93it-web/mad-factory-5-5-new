import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useGetLatestExchangeRate, getGetLatestExchangeRateQueryKey } from "@workspace/api-client-react";
import { DollarSign, Settings, Bell, Factory, Home, ChevronRight, LogOut, Users, ShieldCheck, User, HardDriveDownload, Maximize, Minimize, Download, X, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { ConnectivityBadge } from "@/components/connectivity-badge";
import { UpdateBanner } from "@/components/update-banner";

const INSTALL_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: exchangeRate } = useGetLatestExchangeRate({
    query: { queryKey: getGetLatestExchangeRateQueryKey() },
  });
  const { user, logout } = useAuth();
  const isHome = location === "/";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const isPWA = window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: standalone)").matches;

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // fullscreen not supported or denied
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Capture beforeinstallprompt — show banner unless dismissed within last 7 days
  useEffect(() => {
    if (isPWA) return;
    const isStillDismissed = () => {
      const ts = localStorage.getItem("pwa-install-dismissed-at");
      if (!ts) return false;
      return Date.now() - Number(ts) < INSTALL_DISMISS_TTL_MS;
    };
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      if (!isStillDismissed()) setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isPWA]);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  const dismissBanner = useCallback(() => {
    setShowInstallBanner(false);
    localStorage.setItem("pwa-install-dismissed-at", String(Date.now()));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col" dir="rtl">
      {/* Top Header — no sidebar */}
      <header className="h-16 bg-gradient-to-l from-primary via-primary to-primary/95 text-primary-foreground flex items-center justify-between px-6 shadow-md z-10 sticky top-0 border-b border-primary/20 print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="bg-accent/20 p-2 rounded-lg ring-1 ring-accent/30 group-hover:ring-accent/60 transition-all">
              <Factory className="h-5 w-5 text-accent" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-bold tracking-wide">کارگەی خشتی ماد</h1>
              <p className="text-[10px] text-primary-foreground/60">سیستەمی بەڕێوەبردنی کارگە</p>
            </div>
          </Link>
          {!isHome && (
            <>
              <div className="h-7 w-px bg-primary-foreground/20 mx-2" />
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm hover:text-accent transition-colors px-2 py-1 rounded-md hover:bg-primary-foreground/5"
              >
                <Home className="h-3.5 w-3.5" />
                داشبۆردی سەرەکی
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          {exchangeRate ? (
            <div className="flex items-stretch gap-0 rounded-lg overflow-hidden ring-1 ring-accent/40 shadow-sm">
              <div className="bg-accent/15 px-2.5 flex items-center">
                <DollarSign className="h-4 w-4 text-accent" />
              </div>
              <div className="bg-primary-foreground/10 px-3 py-1.5 flex flex-col leading-tight">
                <span className="text-[9px] uppercase tracking-wider text-primary-foreground/60">نرخی دۆلار</span>
                <span className="text-sm font-bold tabular-nums" dir="ltr">
                  1 USD = {Number(exchangeRate.rate).toLocaleString('en-US')} IQD
                </span>
              </div>
            </div>
          ) : (
            <div className="h-9 w-44 bg-primary-foreground/10 animate-pulse rounded-lg" />
          )}

          <ConnectivityBadge />

          <Link href="/alerts" className="relative p-2 rounded-full hover:bg-primary-foreground/10 transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-primary" />
          </Link>

          <Link href="/settings" className="p-2 rounded-full hover:bg-primary-foreground/10 transition-colors">
            <Settings className="h-5 w-5" />
          </Link>

          {!isPWA && installPrompt && (
            <button
              onClick={handleInstall}
              title="نصبکردن بۆ دێسکتاپ (فولسکرین ئۆتۆماتیک)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-xs font-medium transition-colors ring-1 ring-accent/40"
            >
              <Download className="h-4 w-4" />
              نصب بکە
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "دەرچوون لە فولسکرین" : "فولسکرین"}
            className="p-2 rounded-full hover:bg-primary-foreground/10 transition-colors"
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>

          {user?.role === "admin" && (
            <>
              <Link href="/users" className="p-2 rounded-full hover:bg-primary-foreground/10 transition-colors" title="بەڕێوەبردنی بەکارهێنەران">
                <Users className="h-5 w-5" />
              </Link>
              <Link href="/backup" className="p-2 rounded-full hover:bg-primary-foreground/10 transition-colors" title="باکئەپ و گەڕاندنەوە">
                <HardDriveDownload className="h-5 w-5" />
              </Link>
            </>
          )}

          <div className="h-7 w-px bg-primary-foreground/20" />

          <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-lg px-3 py-1.5">
            {user?.role === "admin"
              ? <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
              : <User className="h-4 w-4 text-primary-foreground/70 shrink-0" />}
            <span className="text-sm font-medium max-w-[80px] truncate" dir="ltr">{user?.username}</span>
          </div>

          <button
            onClick={() => logout()}
            title="دەرچوون"
            className="p-2 rounded-full hover:bg-red-500/20 transition-colors text-primary-foreground/80 hover:text-red-300"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Update available banner */}
      <UpdateBanner />

      {/* PWA Install Banner */}
      {showInstallBanner && !isPWA && (
        <div className="bg-accent text-accent-foreground px-6 py-3 flex items-center justify-between gap-4 print:hidden" dir="rtl">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 shrink-0" />
            <div className="text-sm">
              <span className="font-semibold">ئەپەکە نصب بکە بۆ دێسکتاپ</span>
              <span className="text-accent-foreground/80 mr-2">— هەر جارێک کە کرانەوە ئۆتۆماتیک فولسکرین دەبێت</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstall}
              className="bg-accent-foreground text-accent px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
            >
              نصب بکە
            </button>
            <button onClick={dismissBanner} className="p-1.5 hover:bg-accent-foreground/10 rounded-full transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Breadcrumb sub-bar (only on inner pages) */}
      {!isHome && (
        <div className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-6 py-2 print:hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5 min-w-0">
              <Link href="/" className="hover:text-primary transition-colors shrink-0">سەرەکی</Link>
              <ChevronRight className="h-3 w-3 rotate-180 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{titleFromPath(location)}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const ev = new CustomEvent("app:back-request", { cancelable: true });
                const notHandled = window.dispatchEvent(ev);
                if (!notHandled) return;
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = "/";
                }
              }}
              title="گەڕانەوە بۆ پێشوو"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 transition-colors shrink-0"
              data-testid="button-global-back"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              گەڕانەوە
            </button>
          </div>
        </div>
      )}

      {/* Main Content — full width centered, no sidebar */}
      <main className="flex-1 overflow-y-auto p-6 print:p-0">
        <div className="max-w-7xl mx-auto print:max-w-none">{children}</div>
      </main>
    </div>
  );
}

function titleFromPath(path: string): string {
  const map: Record<string, string> = {
    "/sales": "پسووڵەکانی فرۆشتن",
    "/sales/new": "پسووڵەی فرۆشتنی نوێ",
    "/purchases": "پسووڵەکانی کڕین",
    "/purchases/new": "پسووڵەی کڕینی نوێ",
    "/customers": "کڕیارەکان",
    "/suppliers": "دابینکارەکان",
    "/materials": "کەرەستەکان",
    "/cashbox": "خەزینە و دارایی",
    "/customer-payments": "پارەدانی کڕیار",
    "/supplier-payments": "پارەدانی دابینکار",
    "/employees": "کارمەندان",
    "/payroll": "مووچە",
    "/payroll/slip": "وەسڵی مووچە",
    "/expenses": "خەرجیەکان",
    "/incomes": "داهاتی تر",
    "/shareholders": "شریکەکان",
    "/alerts": "ئاگادارکردنەوەکان",
    "/debtors": "لیستی قەرزەکان",
    "/customer-statement": "کەشف حسابی کڕیار",
    "/settings": "ڕێکخستنەکان",
    "/monthly-report": "ڕاپۆرتی مانگانە",
    "/sales-report": "ڕاپۆرتی فرۆشتن",
    "/profit-loss": "قازانج و زیان",
    "/monthly-closings": "داخستنە مانگانەکان",
    "/treasury-movements": "جووڵەی خەزینە",
  };
  if (map[path]) return map[path];
  if (path.startsWith("/sales/")) return "پسووڵەی فرۆشتن";
  if (path.startsWith("/purchases/")) return "پسووڵەی کڕین";
  if (path.startsWith("/customers/")) return "کەشف حسابی کڕیار";
  if (path.startsWith("/suppliers/")) return "کەشف حسابی دابینکار";
  if (path.startsWith("/payroll/slip/")) return "وەسڵی مووچەی کارمەند";
  return "";
}
