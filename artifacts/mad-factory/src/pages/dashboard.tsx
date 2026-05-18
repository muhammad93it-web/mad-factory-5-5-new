import { Link } from "wouter";
import {
  ShoppingCart, Users, Truck, Banknote, Package, FileText, CreditCard,
  Wallet, Bell, UserCircle2, Briefcase, Calculator, PiggyBank, BarChart3,
  Receipt, Settings as SettingsIcon, DollarSign, CalendarRange, AlertCircle,
  TrendingUp, ListChecks, Clock, ArrowDownToLine, ArrowUpFromLine, Hammer,
  ShieldCheck, UserCog, Warehouse, FileSpreadsheet, Tag, History,
} from "lucide-react";

type PillItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

type PillColumn = {
  items: PillItem[];
  pill: string;
  chip: string;
};

type Section = {
  title: string;
  header: string;
  arrow: string;
  columns: PillColumn[];
};

const sections: Section[] = [
  {
    title: "فرۆشتن 1",
    header: "bg-gradient-to-l from-emerald-500 to-emerald-600 text-white",
    arrow: "border-t-emerald-600",
    columns: [
      // Right column — primary green
      {
        pill: "bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white",
        chip: "bg-white/20 text-white",
        items: [
          { label: "فرۆشتن", href: "/sales/new", icon: ShoppingCart },
          { label: "پارەدانی کڕیار", href: "/customer-payments", icon: CreditCard },
          { label: "کەشف حسابی کڕیار", href: "/customer-statement", icon: FileText },
          { label: "قازانج", href: "/profit-loss", icon: BarChart3 },
          { label: "ڕاپۆرتی قەرزارەکان", href: "/debtors", icon: AlertCircle },
          { label: "ناوی کڕیارەکان", href: "/customers", icon: UserCircle2 },
        ],
      },
      // Left column — lighter teal/cyan
      {
        pill: "bg-gradient-to-l from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white",
        chip: "bg-white/25 text-white",
        items: [
          { label: "فرۆشی ڕۆژانە", href: "/sales", icon: Clock },
          { label: "فرۆشتراوەکان بە پێی بەروار", href: "/sales-report", icon: CalendarRange },
          { label: "قەرزی کۆنی کڕیار", href: "/debtors", icon: History },
          { label: "پسووڵە کۆنەکان", href: "/sales", icon: Receipt },
          { label: "لیستی ئاگادارکردنەوە", href: "/alerts", icon: Bell },
        ],
      },
    ],
  },
  {
    title: "کڕین 1 و 2",
    header: "bg-gradient-to-l from-blue-700 to-blue-800 text-white",
    arrow: "border-t-blue-800",
    columns: [
      // Right column — light sky blue (IQD + USD purchase ops)
      {
        pill: "bg-gradient-to-l from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-600 text-white",
        chip: "bg-white/25 text-white",
        items: [
          { label: "کڕین 1 (دینار)", href: "/purchases/new", icon: Truck },
          { label: "پارەدانی دابینکار", href: "/supplier-payments", icon: Receipt },
          { label: "کەشف حسابی دابینکار", href: "/supplier-statement", icon: FileText },
          { label: "کڕین 2 ($$)", href: "/purchases/new", icon: DollarSign },
          { label: "نرخی دۆلار", href: "/settings", icon: Tag },
        ],
      },
      // Left column — dark blue (purchase reports)
      {
        pill: "bg-gradient-to-l from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white",
        chip: "bg-white/25 text-white",
        items: [
          { label: "کڕینی ڕۆژانە", href: "/purchases", icon: Clock },
          { label: "کڕاوەکان بە پێی بەروار", href: "/purchases", icon: CalendarRange },
          { label: "کەشف حسابی دابینکار", href: "/supplier-statement", icon: FileText },
          { label: "ڕاپۆرتی قەرزاری دابینکار", href: "/alerts", icon: AlertCircle },
          { label: "ناوی دابینکارەکان", href: "/suppliers", icon: Briefcase },
        ],
      },
    ],
  },
  {
    title: "بەشەکانی تر",
    header: "bg-gradient-to-l from-rose-500 to-rose-600 text-white",
    arrow: "border-t-rose-600",
    columns: [
      // Right column — amber/yellow (treasury & cash flow)
      {
        pill: "bg-gradient-to-l from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white",
        chip: "bg-white/25 text-white",
        items: [
          { label: "صندوق", href: "/cashbox", icon: Banknote },
          { label: "مەسروف", href: "/expenses", icon: Wallet },
          { label: "داهات", href: "/incomes", icon: PiggyBank },
          { label: "پارەهێنان (شریک)", href: "/shareholders", icon: ArrowDownToLine },
          { label: "پارەبردن (شریک)", href: "/shareholders", icon: ArrowUpFromLine },
        ],
      },
      // Left column — red (operations & permissions)
      {
        pill: "bg-gradient-to-l from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white",
        chip: "bg-white/25 text-white",
        items: [
          { label: "مەوادەکان", href: "/materials", icon: Package },
          { label: "موچە", href: "/payroll", icon: Calculator },
          { label: "کارمەندان", href: "/employees", icon: Users },
          { label: "ڕێکخستن", href: "/settings", icon: ShieldCheck },
        ],
      },
    ],
  },
];

export default function Dashboard() {
  const totalCols = sections.reduce((s, sec) => s + sec.columns.length, 0);

  return (
    <div className="space-y-6">
      {/* Title strip */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold">
            ڤێرژنی یەکەم
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            کارگەی خشتی ماد
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">سیستەمی بەڕێوەبردنی کارگە</p>
        </div>
      </div>

      {/* Sections — pill grid in the reference style */}
      <div
        className="grid gap-x-5 gap-y-4 items-start"
        style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}
      >
        {/* Row 1: section headers (each spans its column count) */}
        {sections.map((sec, si) => (
          <div
            key={`h-${si}`}
            style={{ gridColumn: `span ${sec.columns.length} / span ${sec.columns.length}` }}
            className="flex flex-col items-center"
          >
            <div className={`relative w-full max-w-md ${sec.header} rounded-2xl px-6 py-2.5 shadow-md`}>
              <h2 className="text-center font-bold text-base">{sec.title}</h2>
              <div
                className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 ${sec.header.split(' ').filter(c => c.startsWith('from-') || c.startsWith('to-') || c.startsWith('bg-')).join(' ')}`}
              />
            </div>
          </div>
        ))}

        {/* Row 2..: pills, one column per PillColumn */}
        {sections.flatMap((sec, si) =>
          sec.columns.map((col, ci) => (
            <div key={`c-${si}-${ci}`} className="flex flex-col gap-2.5">
              {col.items.map((item, ii) => (
                <Link key={ii} href={item.href}>
                  <div
                    className={`group ${col.pill} rounded-2xl px-3.5 py-3 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer flex items-center gap-3`}
                  >
                    <span className="flex-1 text-right font-bold text-sm leading-tight">
                      {item.label}
                    </span>
                    <div className={`${col.chip} rounded-lg p-1.5 shrink-0 ring-1 ring-white/20`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
