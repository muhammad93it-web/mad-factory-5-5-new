import { useEffect, useMemo, useRef, useState } from "react";
import {
  useListMaterials,
  useCreateMaterial,
  useUpdateMaterial,
  useDeleteMaterial,
  getListMaterialsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Lock,
  LockOpen,
  Plus,
  RotateCw,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

type ItemType = "buy" | "sell" | "both";

type MaterialRow = {
  id: number;
  name: string;
  unit: string | null;
  purchasePrice: number;
  salePrice: number | null;
  profit: number | null;
  category: string | null;
  itemType: ItemType;
  bricksPerPallet: number | null;
  notes: string | null;
};

const CATEGORY_OPTIONS = [
  { value: "", label: "0" },
  { value: "sale", label: "فرۆشتن" },
  { value: "purchase", label: "کڕین" },
];

const ITEM_TYPE_OPTIONS: { value: ItemType; label: string; cls: string }[] = [
  { value: "both", label: "هەردووک", cls: "text-violet-700" },
  { value: "buy", label: "کڕین", cls: "text-rose-700" },
  { value: "sell", label: "فرۆشتن", cls: "text-emerald-700" },
];

const UNIT_OPTIONS = ["", "بالێت", "خشتە", "کیلۆ", "تۆن", "دانە", "کارتۆن", "لیتر", "مەتر"];

export default function Materials() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: materials, isLoading, refetch } = useListMaterials(
    {},
    { query: { queryKey: getListMaterialsQueryKey({}) } },
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey({}) });
  const { mutate: create } = useCreateMaterial({ mutation: { onSuccess: invalidate } });
  const { mutate: update } = useUpdateMaterial({ mutation: { onSuccess: invalidate } });
  const { mutate: del } = useDeleteMaterial({ mutation: { onSuccess: invalidate } });

  const list = useMemo<MaterialRow[]>(() => {
    return (materials ?? []).map((m: {
      id: number;
      name: string;
      unit?: string | null;
      purchasePrice: number;
      salePrice?: number | null;
      profit?: number | null;
      category?: string | null;
      itemType?: string | null;
      bricksPerPallet?: number | null;
      notes?: string | null;
    }) => ({
      id: m.id,
      name: m.name,
      unit: m.unit ?? null,
      purchasePrice: Number(m.purchasePrice ?? 0),
      salePrice: m.salePrice != null ? Number(m.salePrice) : null,
      profit: m.profit != null ? Number(m.profit) : null,
      category: m.category ?? null,
      itemType: ((m.itemType as ItemType) ?? "both") as ItemType,
      bricksPerPallet: m.bricksPerPallet ?? null,
      notes: m.notes ?? null,
    }));
  }, [materials]);

  // Search / current row
  const [search, setSearch] = useState("");
  const [currentId, setCurrentId] = useState<number | null>(null);
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});

  // Edit lock — page is read-only until user clicks "کردنەوە"
  const [editLocked, setEditLocked] = useState(true);

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((m) => m.name.toLowerCase().includes(q));
  }, [list, search]);

  useEffect(() => {
    if (currentId == null && list.length) setCurrentId(list[0].id);
  }, [list, currentId]);

  useEffect(() => {
    if (currentId != null && rowRefs.current[currentId]) {
      rowRefs.current[currentId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentId]);

  const navigateRow = (dir: "first" | "prev" | "next" | "last") => {
    if (!list.length) return;
    if (dir === "first") setCurrentId(list[0].id);
    else if (dir === "last") setCurrentId(list[list.length - 1].id);
    else {
      const idx = list.findIndex((m) => m.id === currentId);
      if (idx < 0) return setCurrentId(list[0].id);
      if (dir === "prev" && idx > 0) setCurrentId(list[idx - 1].id);
      if (dir === "next" && idx < list.length - 1) setCurrentId(list[idx + 1].id);
    }
  };

  // Local pending edits keyed by id+field; flush to API on blur
  const [drafts, setDrafts] = useState<Record<number, Partial<MaterialRow>>>({});

  const setDraft = (id: number, patch: Partial<MaterialRow>) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const valueFor = <K extends keyof MaterialRow>(row: MaterialRow, key: K): MaterialRow[K] => {
    const draft = drafts[row.id];
    if (draft && key in draft) return draft[key] as MaterialRow[K];
    return row[key];
  };

  const buildPayload = (draft: Partial<MaterialRow>) => {
    const data: Record<string, unknown> = {};
    if (draft.name !== undefined) data.name = draft.name;
    if (draft.unit !== undefined) data.unit = draft.unit || null;
    if (draft.category !== undefined) data.category = draft.category || null;
    if (draft.itemType !== undefined) data.itemType = draft.itemType;
    if (draft.purchasePrice !== undefined) data.purchasePrice = Number(draft.purchasePrice ?? 0);
    if (draft.salePrice !== undefined) data.salePrice = draft.salePrice == null || Number.isNaN(Number(draft.salePrice)) ? null : Number(draft.salePrice);
    if (draft.profit !== undefined) data.profit = draft.profit == null || Number.isNaN(Number(draft.profit)) ? null : Number(draft.profit);
    if (draft.bricksPerPallet !== undefined) data.bricksPerPallet = draft.bricksPerPallet == null ? null : Number(draft.bricksPerPallet);
    if (draft.notes !== undefined) data.notes = draft.notes || null;
    return data;
  };

  // Compute profit. If BOTH purchase and sale are entered as finite numbers, return the
  // difference. If EITHER is missing, return null so we explicitly clear any stale profit
  // (rather than leaving an out-of-date number in the DB).
  const computeProfit = (
    purchase: number | null | undefined,
    sale: number | null | undefined,
  ): number | null => {
    if (purchase == null || sale == null) return null;
    const p = Number(purchase);
    const s = Number(sale);
    if (!Number.isFinite(p) || !Number.isFinite(s)) return null;
    return Number((s - p).toFixed(2));
  };

  const flushRow = (id: number) => {
    const draft = drafts[id];
    if (!draft || Object.keys(draft).length === 0) return;
    // Auto-compute profit from merged values (always — null when inputs incomplete)
    const row = list.find((r) => r.id === id);
    const purchase = draft.purchasePrice !== undefined ? draft.purchasePrice : row?.purchasePrice;
    const sale = draft.salePrice !== undefined ? draft.salePrice : row?.salePrice;
    draft.profit = computeProfit(purchase as number | null, sale as number | null);
    update({ id, data: buildPayload(draft) });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // Save a single field immediately (used for selects). Avoids the stale-closure trap
  // of setDraft + setTimeout(flushRow) where the next-tick read of `drafts` is still old.
  const saveField = (id: number, patch: Partial<MaterialRow>) => {
    const pendingDraft = drafts[id] ?? {};
    const merged = { ...pendingDraft, ...patch };
    update({ id, data: buildPayload(merged) });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addRow = () => {
    create(
      { data: { name: "ناوی نوێ", purchasePrice: 0 } },
      {
        onSuccess: (m: { id: number }) => {
          setCurrentId(m.id);
          setSearch("");
          setTimeout(() => {
            const el = rowRefs.current[m.id]?.querySelector<HTMLInputElement>('input[data-field="name"]');
            el?.focus();
            el?.select();
          }, 100);
        },
      },
    );
  };

  // Pretty modal-based delete confirmation (replaces window.confirm).
  const [deleteTarget, setDeleteTarget] = useState<MaterialRow | null>(null);

  const requestRemoveRow = (id: number) => {
    const row = list.find((r) => r.id === id);
    if (!row) return;
    setDeleteTarget(row);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    del({ id });
    if (currentId === id) setCurrentId(null);
    setDeleteTarget(null);
  };

  // Live profit = (sale - purchase) computed from current draft+row values, so the cell
  // updates instantly while the user is typing prices, before the API roundtrip.
  const liveProfit = (row: MaterialRow): number | null => {
    const draft = drafts[row.id];
    if (draft && "profit" in draft) return draft.profit ?? null;
    const purchase = draft?.purchasePrice !== undefined ? draft.purchasePrice : row.purchasePrice;
    const sale = draft?.salePrice !== undefined ? draft.salePrice : row.salePrice;
    // computeProfit now returns null when either price is missing — so the cell shows
    // empty rather than a stale value.
    return computeProfit(purchase as number | null, sale as number | null);
  };

  const numberInput = (
    row: MaterialRow,
    field: "purchasePrice" | "salePrice" | "profit" | "bricksPerPallet",
    extra?: string,
  ) => {
    const v = field === "profit" ? liveProfit(row) : valueFor(row, field);
    return (
      <input
        type="number"
        value={v == null ? "" : String(v)}
        data-field={field}
        readOnly={editLocked}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(row.id, { [field]: raw === "" ? null : Number(raw) } as Partial<MaterialRow>);
        }}
        onBlur={() => flushRow(row.id)}
        onFocus={() => setCurrentId(row.id)}
        className={`w-full px-2 py-1.5 bg-transparent border-0 outline-none text-center tabular-nums ${editLocked ? "cursor-not-allowed text-slate-500" : ""} ${extra ?? ""}`}
        placeholder="0"
        dir="ltr"
      />
    );
  };

  return (
    <div className="-m-4 md:-m-6 p-2 md:p-3 min-h-[calc(100vh-7rem)]" dir="rtl">
      <div className="border border-slate-700 bg-white shadow-md flex flex-col h-[calc(100vh-7rem)]">
        {/* ── Top red title bar ──────────────────────────────────────────── */}
        <div className="bg-red-700 text-white flex items-center px-3 py-1.5 gap-2">
          {/* Right-side spacer (mirrors close/open block so title centers) */}
          <div className="w-[180px]"></div>
          <h1 className="flex-1 text-center text-xl font-extrabold tracking-[0.4em]">
            مەوادەکان
            {!editLocked && (
              <span className="ms-3 inline-flex items-center gap-1 text-xs font-semibold tracking-normal bg-emerald-500 text-white px-2 py-0.5 rounded-full align-middle">
                <LockOpen className="h-3 w-3" /> دەستکاری چالاکە
              </span>
            )}
          </h1>
          {/* Left-side buttons — in RTL flex, last items appear leftmost */}
          <button
            onClick={() => setEditLocked((v) => !v)}
            className={`text-xs font-bold px-3 py-1 border flex items-center gap-1 ${
              editLocked
                ? "bg-pink-300 hover:bg-pink-400 text-red-900 border-red-900"
                : "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-800"
            }`}
            title={editLocked ? "کردنەوە بۆ دەستکاری" : "داخستنی دەستکاری"}
          >
            {editLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
            {editLocked ? "کردنەوە" : "داخستن"}
          </button>
          <button
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else navigate("/");
            }}
            className="bg-red-900 hover:bg-red-950 text-white text-xs font-bold px-3 py-1 border border-red-950"
          >
            داخستن
          </button>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-700 text-white text-[12.5px]">
                <th className="border border-slate-500 px-2 py-2 font-bold w-[7%]">ژمارە</th>
                <th className="border border-slate-500 px-2 py-2 font-bold">ناوی مواد</th>
                <th className="border border-slate-500 px-2 py-2 font-bold w-[11%]">نرخی کرین</th>
                <th className="border border-slate-500 px-2 py-2 font-bold w-[10%]">قازانج</th>
                <th className="border border-slate-500 px-2 py-2 font-bold w-[11%]">نرخی فرۆشتن</th>
                <th className="border border-slate-500 px-2 py-2 font-bold w-[10%]">دانەی بالێت</th>
                <th className="border border-slate-500 px-2 py-2 font-bold w-[8%]">یەکە</th>
                <th className="border border-slate-500 px-2 py-2 font-bold w-[10%]">جۆر</th>
                <th className="border border-slate-500 px-2 py-2 font-bold w-[8%]">FK</th>
                <th className="border border-slate-500 px-1 py-2 font-bold w-9"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={10} className="border border-slate-300 px-3 py-8 text-center text-slate-500">بەڕێکردن...</td></tr>
              ) : !filtered.length ? (
                <tr><td colSpan={10} className="border border-slate-300 px-3 py-8 text-center text-slate-500">هیچ ماددەیەک نەدۆزرایەوە</td></tr>
              ) : filtered.map((row) => {
                const isCurrent = row.id === currentId;
                return (
                  <tr
                    key={row.id}
                    ref={(el) => { rowRefs.current[row.id] = el; }}
                    onClick={() => setCurrentId(row.id)}
                    className={isCurrent ? "bg-yellow-50 ring-1 ring-yellow-400" : "hover:bg-slate-50"}
                  >
                    {/* ID (rightmost in RTL = first cell) */}
                    <td className="border border-slate-300 px-2 py-1.5 text-center tabular-nums text-slate-800 bg-slate-50 font-bold">
                      {row.id}
                    </td>

                    {/* Material name */}
                    <td className="border border-slate-300 p-0">
                      <input
                        value={valueFor(row, "name") ?? ""}
                        data-field="name"
                        readOnly={editLocked}
                        onChange={(e) => setDraft(row.id, { name: e.target.value })}
                        onBlur={() => flushRow(row.id)}
                        onFocus={() => setCurrentId(row.id)}
                        className={`w-full px-2 py-1.5 bg-transparent border-0 outline-none text-right font-semibold text-slate-900 ${editLocked ? "cursor-not-allowed" : ""}`}
                        placeholder="ناوی ماددە..."
                      />
                    </td>

                    {/* Purchase price */}
                    <td className="border border-slate-300 p-0">{numberInput(row, "purchasePrice", "text-rose-700 font-semibold")}</td>

                    {/* Profit (auto-computed) */}
                    <td className="border border-slate-300 p-0">{numberInput(row, "profit", "text-emerald-700 font-semibold")}</td>

                    {/* Sale price */}
                    <td className="border border-slate-300 p-0">{numberInput(row, "salePrice", "text-blue-700 font-semibold")}</td>

                    {/* Bricks per pallet */}
                    <td className="border border-slate-300 p-0">{numberInput(row, "bricksPerPallet")}</td>

                    {/* Unit */}
                    <td className="border border-slate-300 p-0">
                      <select
                        value={valueFor(row, "unit") ?? ""}
                        disabled={editLocked}
                        onChange={(e) => saveField(row.id, { unit: e.target.value || null })}
                        onFocus={() => setCurrentId(row.id)}
                        className={`w-full px-2 py-1.5 bg-transparent border-0 outline-none text-center text-sm ${editLocked ? "cursor-not-allowed text-slate-500" : ""}`}
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>{u || "—"}</option>
                        ))}
                      </select>
                    </td>

                    {/* Item type — controls whether this material appears in sales / purchases */}
                    <td className="border border-slate-300 p-0">
                      {(() => {
                        const v = valueFor(row, "itemType") ?? "both";
                        const opt = ITEM_TYPE_OPTIONS.find((o) => o.value === v) ?? ITEM_TYPE_OPTIONS[0];
                        return (
                          <select
                            value={v}
                            disabled={editLocked}
                            onChange={(e) => saveField(row.id, { itemType: e.target.value as ItemType })}
                            onFocus={() => setCurrentId(row.id)}
                            className={`w-full px-2 py-1.5 bg-transparent border-0 outline-none text-center text-sm font-bold ${opt.cls} ${editLocked ? "cursor-not-allowed opacity-70" : ""}`}
                          >
                            {ITEM_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        );
                      })()}
                    </td>

                    {/* FK / Category */}
                    <td className="border border-slate-300 p-0">
                      <select
                        value={valueFor(row, "category") ?? ""}
                        disabled={editLocked}
                        onChange={(e) => saveField(row.id, { category: e.target.value || null })}
                        onFocus={() => setCurrentId(row.id)}
                        className={`w-full px-2 py-1.5 bg-transparent border-0 outline-none text-center text-sm ${editLocked ? "cursor-not-allowed text-slate-500" : ""}`}
                      >
                        {CATEGORY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* Delete (last cell = leftmost in RTL) */}
                    <td className="border border-slate-300 p-0 text-center">
                      <button
                        onClick={() => requestRemoveRow(row.id)}
                        disabled={editLocked}
                        className="inline-flex items-center justify-center w-7 h-7 text-red-600 hover:bg-red-100 disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                        title={editLocked ? "بۆ سڕینەوە، سەرەتا کردنەوە دابگرە" : "سڕینەوە"}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Bottom red action bar ──────────────────────────────────────── */}
        <div className="bg-red-700 text-white flex items-center px-3 py-2 gap-2 flex-wrap">
          {/* Add (right side in RTL) */}
          <button
            onClick={addRow}
            disabled={editLocked}
            className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 border border-emerald-800 flex items-center gap-1 disabled:bg-slate-400 disabled:border-slate-500 disabled:cursor-not-allowed"
            title={editLocked ? "بۆ زیادکردن، سەرەتا کردنەوە دابگرە" : "زیادکردن"}
          >
            <Plus className="h-3.5 w-3.5" />
            زیاد
          </button>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="bg-amber-300 hover:bg-amber-400 text-amber-900 text-xs font-bold px-4 py-1.5 border border-amber-700"
          >
            ڕیفرێش
          </button>

          {/* Navigation */}
          <div className="flex items-center gap-0.5 bg-white border border-slate-300">
            <button onClick={() => navigateRow("prev")} className="p-1.5 hover:bg-slate-100 text-slate-700" title="پێشوو">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button onClick={() => navigateRow("first")} className="p-1.5 hover:bg-slate-100 text-slate-700" title="یەکەم">
              <ChevronsRight className="h-4 w-4" />
            </button>
            <button onClick={() => navigateRow("last")} className="p-1.5 hover:bg-slate-100 text-slate-700" title="کۆتا">
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button onClick={() => navigateRow("next")} className="p-1.5 hover:bg-slate-100 text-slate-700" title="دواتر">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1"></div>

          {/* Search button */}
          <button
            onClick={() => {
              const m = list.find((x) => x.name.toLowerCase() === search.toLowerCase());
              if (m) setCurrentId(m.id);
            }}
            className="bg-pink-300 hover:bg-pink-400 text-red-900 text-xs font-bold px-4 py-1.5 border border-red-900 flex items-center gap-1"
          >
            <Search className="h-3.5 w-3.5" />
            گەڕان
          </button>

          {/* Search combobox */}
          <select
            value=""
            onChange={(e) => {
              const id = Number(e.target.value);
              if (!Number.isNaN(id)) {
                setCurrentId(id);
                const m = list.find((x) => x.id === id);
                if (m) setSearch(m.name);
              }
            }}
            className="bg-white text-slate-900 text-xs px-2 py-1.5 border border-slate-300 min-w-[260px]"
          >
            <option value="">— هەڵبژاردن —</option>
            {list.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="گەڕان بە ناو..."
            className="bg-white text-slate-900 text-xs px-2 py-1.5 border border-slate-300 w-[200px]"
          />
        </div>

        {/* Status footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-3 py-1 text-[11px] text-slate-600 flex items-center justify-between">
          <span>{filtered.length} لە {list.length} ماددە</span>
          {currentId != null && (
            <span>تۆماری ئێستا: <strong className="tabular-nums">{currentId}</strong></span>
          )}
          <span className="flex items-center gap-1"><RotateCw className="h-3 w-3" /> گۆڕانکارییەکان خۆکارانە تۆمار دەکرێن</span>
        </div>
      </div>

      {/* ── Pretty Delete Confirmation Modal ──────────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setDeleteTarget(null)}
        >
          {/* Backdrop with blur */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

          {/* Card */}
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-200 animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Decorative red gradient header with icon */}
            <div className="relative bg-gradient-to-br from-rose-500 via-red-600 to-red-700 px-6 pt-8 pb-12 text-center">
              {/* Subtle pattern */}
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)",
                backgroundSize: "40px 40px"
              }} />
              {/* Close X in corner */}
              <button
                onClick={() => setDeleteTarget(null)}
                className="absolute top-3 left-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition"
                aria-label="داخستن"
              >
                <X className="h-5 w-5" />
              </button>
              {/* Big circular alert icon */}
              <div className="relative mx-auto w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center ring-4 ring-white/30 shadow-lg">
                <TriangleAlert className="h-11 w-11 text-white drop-shadow" strokeWidth={2.2} />
              </div>
              <h2 className="relative mt-4 text-2xl font-extrabold text-white drop-shadow-sm">
                دڵنیای؟
              </h2>
              <p className="relative mt-1 text-sm text-white/90 font-medium">
                ئەم کردارە ناتوانرێت بگەڕێندرێتەوە
              </p>
            </div>

            {/* Body — material info + question */}
            <div className="px-6 pt-6 pb-2 -mt-6">
              {/* Floating material chip */}
              <div className="mx-auto bg-white rounded-xl border border-slate-200 shadow-md p-4 flex items-center gap-3">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-rose-100 to-red-100 flex items-center justify-center text-rose-700 ring-1 ring-rose-200">
                  <Trash2 className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    ماددەی هەڵبژێردراو
                  </div>
                  <div className="text-base font-extrabold text-slate-900 truncate">
                    {deleteTarget.name?.trim() || `#${deleteTarget.id}`}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>کۆد: <span className="tabular-nums font-semibold">{deleteTarget.id}</span></span>
                    {deleteTarget.unit && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>یەکە: <span className="font-semibold">{deleteTarget.unit}</span></span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-center text-sm text-slate-700 leading-relaxed">
                دڵنیای لە سڕینەوەی ئەم ماددەیە؟
                <br />
                <span className="text-xs text-slate-500">
                  دەستڕاگەیشتن بە هەموو زانیارییەکانی لەدەست دەدەیت
                </span>
              </p>
            </div>

            {/* Action buttons */}
            <div className="px-6 pt-5 pb-6 flex items-center gap-3" dir="ltr">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition border border-slate-200"
              >
                نەخێر
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                بەڵێ، بیسڕەوە
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
