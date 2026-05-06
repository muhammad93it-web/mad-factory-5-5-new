import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { formatMoney } from "@/lib/format";
import {
  useListPayrollEntries,
  useCreatePayrollEntry,
  useDeletePayrollEntry,
  useListEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  getListPayrollEntriesQueryKey,
  getListEmployeesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  ChevronsRight,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  Plus,
  Trash2,
  Printer,
} from "lucide-react";

type EmpForm = {
  id: number | null;
  code: string;
  name: string;
  role: string;
  phone: string;
  phone2: string;
  phone3: string;
  notes: string;
  birthPlace: string;
  address: string;
  educationLevel: string;
  hireDate: string;
  birthYear: string;
  salary: string;
};

const EMPTY_EMP: EmpForm = {
  id: null,
  code: "",
  name: "",
  role: "",
  phone: "",
  phone2: "",
  phone3: "",
  notes: "",
  birthPlace: "",
  address: "",
  educationLevel: "",
  hireDate: "",
  birthYear: "",
  salary: "",
};

export default function Payroll() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"single" | "monthly" | "yearly" | "info" | "g1" | "g2" | "addMonth">("single");
  const [emp, setEmp] = useState<EmpForm>(EMPTY_EMP);
  const [searchName, setSearchName] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchNumber, setSearchNumber] = useState("");
  const [showAddMonth, setShowAddMonth] = useState(false);
  const today = new Date();
  const [newMonth, setNewMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    workDays: "1",
    dailyRate: "",
    received: "0",
    notes: "",
  });

  const { data: employees = [] } = useListEmployees({}, { query: { queryKey: getListEmployeesQueryKey({}) } });
  const { data: allEntries = [] } = useListPayrollEntries({}, { query: { queryKey: getListPayrollEntriesQueryKey({}) } });

  const { mutate: createEmp, isPending: creatingEmp } = useCreateEmployee({
    mutation: { onSuccess: (e) => { queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey({}) }); setEmp((p) => ({ ...p, id: e.id })); } },
  });
  const { mutate: updateEmp } = useUpdateEmployee({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey({}) }) },
  });
  const { mutate: createEntry, isPending: creatingEntry } = useCreatePayrollEntry({
    mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPayrollEntriesQueryKey({}) }); setShowAddMonth(false); } },
  });
  const { mutate: delEntry } = useDeletePayrollEntry({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListPayrollEntriesQueryKey({}) }) },
  });

  // Auto-fill employee form when search by name/code/number changes
  const loadEmp = (e: any) => {
    setEmp({
      id: e.id,
      code: e.code ?? "",
      name: e.name ?? "",
      role: e.role ?? "",
      phone: e.phone ?? "",
      phone2: e.phone2 ?? "",
      phone3: e.phone3 ?? "",
      notes: e.notes ?? "",
      birthPlace: e.birthPlace ?? "",
      address: e.address ?? "",
      educationLevel: e.educationLevel ?? "",
      hireDate: e.hireDate ?? "",
      birthYear: e.birthYear ?? "",
      salary: e.salary != null ? String(e.salary) : "",
    });
  };

  useEffect(() => {
    if (!searchName) return;
    const f = employees.find((e) => e.name === searchName);
    if (f) loadEmp(f);
  }, [searchName, employees]);
  useEffect(() => {
    if (!searchCode) return;
    const f = employees.find((e) => e.code === searchCode);
    if (f) loadEmp(f);
  }, [searchCode, employees]);
  useEffect(() => {
    if (!searchNumber) return;
    const idx = Number(searchNumber);
    if (!Number.isFinite(idx) || idx < 1) return;
    const f = employees[idx - 1];
    if (f) loadEmp(f);
  }, [searchNumber, employees]);

  const empEntries = useMemo(
    () => allEntries.filter((e) => emp.id != null && e.employeeId === emp.id),
    [allEntries, emp.id],
  );

  const totals = useMemo(() => {
    let totalDue = 0, paid = 0, remaining = 0;
    for (const e of empEntries) {
      totalDue += Number(e.totalDue) || 0;
      paid += Number(e.paidAmount) || 0;
      remaining += Number(e.remainingAmount) || 0;
    }
    return { totalDue, paid, remaining };
  }, [empEntries]);

  const handleSaveEmp = () => {
    if (!emp.name.trim()) { alert("ناوی کرێکار داخڵ بکە"); return; }
    if (!emp.code.trim()) { alert("کۆد داخڵ بکە"); return; }
    const data = {
      code: emp.code,
      name: emp.name,
      role: emp.role || null,
      phone: emp.phone || null,
      phone2: emp.phone2 || null,
      phone3: emp.phone3 || null,
      notes: emp.notes || null,
      birthPlace: emp.birthPlace || null,
      address: emp.address || null,
      educationLevel: emp.educationLevel || null,
      hireDate: emp.hireDate || null,
      birthYear: emp.birthYear || null,
      salary: Number(emp.salary) || 0,
    };
    if (emp.id) updateEmp({ id: emp.id, data });
    else createEmp({ data });
  };

  const handleClear = () => {
    setEmp(EMPTY_EMP);
    setSearchName("");
    setSearchCode("");
    setSearchNumber("");
  };

  const navIdx = emp.id ? employees.findIndex((e) => e.id === emp.id) : -1;
  const goNav = (where: "first" | "prev" | "next" | "last") => {
    if (!employees.length) return;
    let i = navIdx;
    if (where === "first") i = 0;
    else if (where === "last") i = employees.length - 1;
    else if (where === "prev") i = Math.max(0, navIdx - 1);
    else if (where === "next") i = Math.min(employees.length - 1, navIdx < 0 ? 0 : navIdx + 1);
    if (employees[i]) loadEmp(employees[i]);
  };

  const handleAddMonth = () => {
    if (!emp.id) { alert("سەرەتا کرێکار هەڵبژێرە"); return; }
    const year = Number(newMonth.year);
    const month = Number(newMonth.month);
    const days = Number(newMonth.workDays) || 0;
    const dailyRate = Number(newMonth.dailyRate) || Number(emp.salary) || 0;
    const baseSalary = days * dailyRate;
    const paidAmount = Number(newMonth.received) || 0;
    if (!year || !month) { alert("ساڵ و مانگ پێویستن"); return; }
    createEntry({
      data: {
        employeeId: emp.id,
        period: `${year}-${String(month).padStart(2, "0")}`,
        workDays: days,
        baseSalary,
        bonus: 0,
        deductions: 0,
        paidAmount,
        paymentDate: new Date().toISOString().split("T")[0],
        notes: newMonth.notes || null,
      },
    });
  };

  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

  return (
    <div className="-m-4 md:-m-6 h-screen flex flex-col overflow-hidden text-[12px]" dir="rtl" lang="en-US">
      {/* HEADER */}
      <div className="bg-[#7030a0] text-white py-1.5 text-center shrink-0">
        <h1 className="text-xl font-bold tracking-widest" style={{ letterSpacing: "0.4em" }}>مووچەی کرێکاران</h1>
      </div>

      {/* TOP TABS */}
      <div className="bg-slate-50 border-y border-slate-300 px-1.5 py-1 flex flex-row-reverse flex-wrap gap-1 shrink-0">
        <input
          value={searchNumber}
          onChange={(e) => setSearchNumber(e.target.value)}
          inputMode="numeric"
          lang="en-US"
          className="border border-slate-400 bg-white rounded-sm px-1.5 py-0.5 text-[12px] w-20 text-center font-mono"
          placeholder="ژمارە"
        />
        <button onClick={() => setActiveTab("g1")} className={tabCls(activeTab === "g1")}>ڕاپۆرتی گشتی 1</button>
        <button onClick={() => setActiveTab("g2")} className={tabCls(activeTab === "g2")}>ڕاپۆرتی گشتی 2</button>
        <button onClick={() => setActiveTab("info")} className={tabCls(activeTab === "info")}>زانیاری</button>
        <button onClick={() => setActiveTab("single")} className={tabCls(activeTab === "single")}>ڕاپۆرتی تاك</button>
        <button onClick={() => setActiveTab("yearly")} className={tabCls(activeTab === "yearly")}>ڕاپۆرتی ساڵانە</button>
        <button onClick={() => { setActiveTab("addMonth"); setShowAddMonth(true); }} className={tabCls(activeTab === "addMonth")}>زیادکردنی مانگ</button>
        <button onClick={() => setActiveTab("monthly")} className={tabCls(activeTab === "monthly")}>ڕاپۆرتی مانگانە</button>
      </div>

      {/* MAIN BODY */}
      <div className="p-1 grid grid-cols-12 gap-1.5 bg-slate-100 flex-1 min-h-0 overflow-hidden">
        {/* LEFT PANEL: Salary grid (~70%) — order-2 in RTL grid puts it on the LEFT */}
        <div className="col-span-12 lg:col-span-8 order-2 flex flex-col gap-1 min-h-0">
          {/* Data grid - only this scrolls; container has no bg so empty area collapses visually */}
          <div className="overflow-y-auto flex-1 min-h-0">
            <table className="w-full text-sm border-collapse bg-white border border-slate-400" dir="rtl">
              <thead>
                <tr className="bg-[#92d050] text-slate-900">
                  <Th>Tebene</Th>
                  <Th>ساڵ</Th>
                  <Th>مانگ</Th>
                  <Th>ڕۆژ</Th>
                  <Th>مووچەی ڕۆژ</Th>
                  <Th>کۆی موچە</Th>
                  <Th>وەگیراو</Th>
                  <Th>کۆی گشتی پارە</Th>
                  <Th>کارەکان</Th>
                </tr>
              </thead>
              <tbody>
                {!emp.id ? (
                  <tr><td colSpan={9} className="border border-slate-300 px-3 py-8 text-center text-slate-500">کرێکار هەڵبژێرە</td></tr>
                ) : empEntries.length === 0 ? (
                  <tr><td colSpan={9} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ مانگێک تۆمار نەکراوە</td></tr>
                ) : empEntries.map((e, i) => {
                  const [yyyy, mm] = (e.period || "").split("-");
                  const days = Number(e.workDays) || 0;
                  const dailyRate = days > 0 ? Number(e.baseSalary) / days : Number(e.baseSalary);
                  return (
                    <tr key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <Td center mono>{e.period}</Td>
                      <Td center mono>{yyyy}</Td>
                      <Td center mono>{Number(mm)}</Td>
                      <Td center mono>{days}</Td>
                      <Td center mono>{fmt(dailyRate)}</Td>
                      <Td center mono>{fmt(Number(e.totalDue))}</Td>
                      <Td center mono className="text-blue-600">{fmt(Number(e.paidAmount))}</Td>
                      <Td center mono className={Number(e.remainingAmount) > 0 ? "text-red-600 font-semibold" : ""}>{fmt(Number(e.remainingAmount))}</Td>
                      <Td center>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => navigate(`/payroll/slip/${e.employeeId}`)} className="p-1 hover:bg-sky-100 rounded text-sky-600" title="چاپ">
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => { if (confirm("سڕینەوەی ئەم مانگە؟")) delEntry({ id: e.id }); }} className="p-1 hover:bg-red-100 rounded text-red-600" title="سڕینەوە">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals row - aligned right under last 3 data columns */}
          <div className="flex justify-start gap-1.5 shrink-0" dir="rtl">
            <div className="border border-slate-400 bg-white px-2 py-1 text-center font-mono font-semibold min-w-[90px] text-[12px]">{fmt(totals.totalDue)}</div>
            <div className="border border-slate-400 bg-white px-2 py-1 text-center font-mono font-semibold text-blue-600 min-w-[90px] text-[12px]">{fmt(totals.paid)}</div>
            <div className="border border-slate-400 bg-white px-2 py-1 text-center font-mono font-semibold text-emerald-700 min-w-[90px] text-[12px]">{fmt(totals.remaining)}</div>
          </div>

          {/* Action row - separate distinct div, flows naturally below totals */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <div className="flex items-center gap-0.5">
              <NavBtn onClick={() => goNav("last")}><ChevronsLeft className="h-4 w-4" /></NavBtn>
              <NavBtn onClick={() => goNav("next")}><ChevronLeft className="h-4 w-4" /></NavBtn>
              <NavBtn onClick={() => goNav("prev")}><ChevronRight className="h-4 w-4" /></NavBtn>
              <NavBtn onClick={() => goNav("first")}><ChevronsRight className="h-4 w-4" /></NavBtn>
            </div>
            <button
              onClick={() => { setShowAddMonth(true); setNewMonth({ year: today.getFullYear(), month: today.getMonth() + 1, workDays: "1", dailyRate: emp.salary, received: "0", notes: "" }); }}
              disabled={!emp.id}
              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 border border-slate-400 rounded-sm text-[12px] disabled:opacity-50 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> زیادکردنی موچە
            </button>
            <button className="px-2 py-1 bg-slate-200 hover:bg-slate-300 border border-slate-400 rounded-sm text-[12px]">
              گۆڕینی مانگی(13)بۆ (1)
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Employee details (~30%) — order-1 in RTL grid puts it on the RIGHT */}
        <div className="col-span-12 lg:col-span-4 order-1 overflow-y-auto min-h-0">
          <div className="bg-white border border-slate-400 p-1.5 space-y-0.5">
            <Field label="ژمارە" value={navIdx >= 0 ? String(navIdx + 1) : ""} readOnly mono />
            <Field label="ناوی سیانی" value={emp.name} onChange={(v) => setEmp({ ...emp, name: v })} />
            <Field label="کۆد" value={emp.code} onChange={(v) => setEmp({ ...emp, code: v })} mono />
            <Field label="جۆری کار" value={emp.role} onChange={(v) => setEmp({ ...emp, role: v })} dropdown options={["مەندوب", "کارگەر", "ئاژۆ", "بەرپرس", "تر"]} />
            <Field label="مۆبایل" value={emp.phone} onChange={(v) => setEmp({ ...emp, phone: v })} dir="ltr" mono />
            <Field label="مۆبایل 2" value={emp.phone2} onChange={(v) => setEmp({ ...emp, phone2: v })} dir="ltr" mono />
            <Field label="مۆبایل 3" value={emp.phone3} onChange={(v) => setEmp({ ...emp, phone3: v })} dir="ltr" mono />
            <Field label="تێبینی" value={emp.notes} onChange={(v) => setEmp({ ...emp, notes: v })} />
            <Field label="شوێنی لە دایک بوون" value={emp.birthPlace} onChange={(v) => setEmp({ ...emp, birthPlace: v })} />
            <Field label="شوێنی نیشتەجێبوون" value={emp.address} onChange={(v) => setEmp({ ...emp, address: v })} />
            <Field label="ئاستی خوێندەواری" value={emp.educationLevel} onChange={(v) => setEmp({ ...emp, educationLevel: v })} />
            <Field label="بەرواری دەستبەکار بوون" value={emp.hireDate} onChange={(v) => setEmp({ ...emp, hireDate: v })} type="date" mono />
            <Field label="ساڵی لە دایکبوون" value={emp.birthYear} onChange={(v) => setEmp({ ...emp, birthYear: v })} type="date" mono />
            <Field label="مووچەی ڕۆژانە" value={emp.salary} onChange={(v) => setEmp({ ...emp, salary: v })} mono inputMode="numeric" />

            {/* Search inputs (green labels) */}
            <div className="pt-1.5 space-y-0.5">
              <SearchField label="گەڕان بە پێی ناو" value={searchName} onChange={setSearchName} options={employees.map((e) => e.name)} />
              <SearchField label="گەڕان بە پێی کۆد" value={searchCode} onChange={setSearchCode} options={employees.map((e) => e.code)} />
              <SearchField label="گەڕان بە پێی ژمارە" value={searchNumber} onChange={setSearchNumber} options={employees.map((_e, i) => String(i + 1))} />
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM BAR */}
      <div className="bg-[#7030a0] text-white px-2 py-1.5 flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={handleClear}
          className="bg-white text-red-600 px-3 py-1 text-sm rounded-sm font-semibold hover:bg-red-50"
          title="پاککردنەوەی فۆڕم"
        >
          پاککردنەوە
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => queryClient.invalidateQueries()} className="bg-slate-200 text-slate-900 px-3 py-1 text-sm rounded-sm flex items-center gap-1 hover:bg-slate-300">
            <RefreshCw className="h-3.5 w-3.5" /> ڕیفریش
          </button>
          <div className="flex items-center gap-0.5">
            <NavBtn onClick={() => goNav("last")} orange><ChevronsLeft className="h-4 w-4" /></NavBtn>
            <NavBtn onClick={() => goNav("next")} orange><ChevronLeft className="h-4 w-4" /></NavBtn>
            <NavBtn onClick={() => goNav("prev")} orange><ChevronRight className="h-4 w-4" /></NavBtn>
            <NavBtn onClick={() => goNav("first")} orange><ChevronsRight className="h-4 w-4" /></NavBtn>
          </div>
          <button
            onClick={handleSaveEmp}
            disabled={creatingEmp}
            className="bg-white text-[#7030a0] px-4 py-1 text-sm rounded-sm font-bold hover:bg-slate-100 disabled:opacity-50"
          >
            {emp.id ? "نوێکردنەوە" : "زیادکردنی ناو"}
          </button>
        </div>
      </div>

      {/* ADD MONTH MODAL */}
      {showAddMonth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddMonth(false)}>
          <div className="bg-white rounded-md shadow-xl p-4 w-[400px] max-w-full" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-lg font-bold border-b pb-2 mb-3">زیادکردنی مانگی نوێ</h3>
            {!emp.id && <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm p-2 mb-2">سەرەتا کرێکار هەڵبژێرە</div>}
            <div className="space-y-2">
              <ModalField label="ساڵ" value={String(newMonth.year)} onChange={(v) => setNewMonth({ ...newMonth, year: Number(v) || 0 })} />
              <div className="flex items-center gap-2">
                <label className="bg-[#d8f4f9] border border-slate-400 px-2 py-1 text-sm w-32 text-right">مانگ</label>
                <select value={newMonth.month} onChange={(e) => setNewMonth({ ...newMonth, month: Number(e.target.value) })} className="border border-slate-400 px-2 py-1 text-sm flex-1">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <ModalField label="ڕۆژانی کارکردن" value={newMonth.workDays} onChange={(v) => setNewMonth({ ...newMonth, workDays: v })} />
              <ModalField label="مووچەی ڕۆژ" value={newMonth.dailyRate} onChange={(v) => setNewMonth({ ...newMonth, dailyRate: v })} />
              <ModalField label="وەگیراو" value={newMonth.received} onChange={(v) => setNewMonth({ ...newMonth, received: v })} />
              <ModalField label="تێبینی" value={newMonth.notes} onChange={(v) => setNewMonth({ ...newMonth, notes: v })} />
              <div className="text-sm text-slate-600 px-1">
                کۆی موچە: <b className="font-mono">{fmt((Number(newMonth.workDays) || 0) * (Number(newMonth.dailyRate) || Number(emp.salary) || 0))}</b>
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAddMonth(false)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-sm text-sm">هەڵوەشاندنەوە</button>
              <button onClick={handleAddMonth} disabled={creatingEntry || !emp.id} className="px-3 py-1.5 bg-[#7030a0] text-white rounded-sm text-sm disabled:opacity-50">{creatingEntry ? "..." : "زیادکردن"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function tabCls(active: boolean) {
  return `px-3 py-1.5 text-sm border border-slate-400 rounded-sm ${active ? "bg-[#92d050] text-slate-900 font-semibold" : "bg-slate-200 hover:bg-slate-300 text-slate-800"}`;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="border border-slate-400 px-1.5 py-1 text-center text-[12px] font-semibold whitespace-nowrap sticky top-0 bg-[#92d050] z-10">{children}</th>;
}
function Td({ children, center, mono, className }: { children: React.ReactNode; center?: boolean; mono?: boolean; className?: string }) {
  return <td className={`border border-slate-300 px-1 py-0.5 text-[12px] ${center ? "text-center" : ""} ${mono ? "font-mono tabular-nums" : ""} ${className ?? ""}`} lang="en-US">{children}</td>;
}
function NavBtn({ children, onClick, orange }: { children: React.ReactNode; onClick: () => void; orange?: boolean }) {
  return (
    <button onClick={onClick} className={`p-1 border border-slate-400 rounded-sm ${orange ? "bg-orange-400 hover:bg-orange-500 text-white" : "bg-slate-100 hover:bg-slate-200"}`}>
      {children}
    </button>
  );
}

function Field({
  label, value, onChange, readOnly, dropdown, options, type, dir, mono, inputMode,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  dropdown?: boolean;
  options?: string[];
  type?: string;
  dir?: "ltr" | "rtl";
  mono?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div className="flex items-center gap-0.5">
      <label className="bg-[#d8f4f9] border border-slate-400 px-1.5 py-0.5 text-[12px] w-32 text-right shrink-0">{label}</label>
      {dropdown ? (
        <>
          <input
            list={`dl-${label}`}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readOnly}
            lang="en-US"
            className={`border border-slate-400 px-1.5 py-0.5 text-[12px] flex-1 min-w-0 ${mono ? "font-mono" : ""}`}
            dir={dir}
          />
          <datalist id={`dl-${label}`}>
            {options?.map((o) => <option key={o} value={o} />)}
          </datalist>
        </>
      ) : (
        <input
          type={type ?? "text"}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          inputMode={inputMode}
          dir={type === "date" ? "ltr" : dir}
          lang="en-US"
          className={`border border-slate-400 px-1.5 py-0.5 text-[12px] flex-1 min-w-0 ${mono ? "font-mono tabular-nums" : ""} ${readOnly ? "bg-slate-50" : "bg-white"}`}
        />
      )}
    </div>
  );
}

function SearchField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex items-center gap-0.5">
      <label className="bg-[#a9d18e] border border-slate-400 px-1.5 py-0.5 text-[12px] w-32 text-right shrink-0">{label}</label>
      <input
        list={`sdl-${label}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        lang="en-US"
        className="border border-slate-400 px-1.5 py-0.5 text-[12px] flex-1 min-w-0 bg-white"
      />
      <datalist id={`sdl-${label}`}>
        {options.map((o, i) => <option key={`${o}-${i}`} value={o} />)}
      </datalist>
    </div>
  );
}

function ModalField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="bg-[#d8f4f9] border border-slate-400 px-2 py-1 text-[12px] w-32 text-right shrink-0">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} lang="en-US" className="border border-slate-400 px-2 py-1 text-[12px] flex-1 min-w-0" />
    </div>
  );
}
