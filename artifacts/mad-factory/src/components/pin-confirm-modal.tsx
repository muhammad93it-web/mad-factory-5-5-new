import { useEffect, useRef, useState } from "react";
import { Trash2, TriangleAlert, X, Lock, Loader2 } from "lucide-react";
import { verifyDeletePin } from "@workspace/api-client-react";

type Stage = "confirm" | "pin";

type Props = {
  open: boolean;
  title?: string;
  message?: string;
  itemSummary?: React.ReactNode;
  onCancel: () => void;
  onConfirmed: () => void;
};

/**
 * Two-stage destructive confirmation:
 *   1. Yes/No question
 *   2. PIN entry that must match the master PIN configured in Settings.
 *
 * Uses the /settings/verify-delete-pin endpoint so the master PIN is never
 * sent to the client.
 */
export function PinConfirmModal({ open, title, message, itemSummary, onCancel, onConfirmed }: Props) {
  const [stage, setStage] = useState<Stage>("confirm");
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStage("confirm");
      setPin("");
      setError(null);
      setVerifying(false);
    }
  }, [open]);

  useEffect(() => {
    if (stage !== "pin") return;
    const t = setTimeout(() => pinRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [stage]);

  if (!open) return null;

  const submitPin = async () => {
    if (!pin) {
      setError("تکایە ژمارەی نهێنی بنووسە");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await verifyDeletePin({ pin });
      if (res.valid) {
        onConfirmed();
      } else {
        setError("ژمارەی نهێنی هەڵەیە");
        setPin("");
        pinRef.current?.focus();
      }
    } catch {
      setError("هەڵە لە پشکنینی ژمارەی نهێنی");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 print:hidden"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-200 animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="relative bg-gradient-to-br from-rose-500 via-red-600 to-red-700 px-6 pt-8 pb-12 text-center">
          <button
            onClick={onCancel}
            className="absolute top-3 left-3 text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition"
            aria-label="داخستن"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative mx-auto w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center ring-4 ring-white/30 shadow-lg">
            {stage === "confirm" ? (
              <TriangleAlert className="h-11 w-11 text-white drop-shadow" strokeWidth={2.2} />
            ) : (
              <Lock className="h-11 w-11 text-white drop-shadow" strokeWidth={2.2} />
            )}
          </div>
          <h2 className="relative mt-4 text-2xl font-extrabold text-white drop-shadow-sm">
            {stage === "confirm" ? (title ?? "دڵنیای؟") : "ژمارەی نهێنی"}
          </h2>
          <p className="relative mt-1 text-sm text-white/90 font-medium">
            {stage === "confirm"
              ? (message ?? "ئەم ڕیزە لادەبرێت")
              : "بۆ سڕینەوە، ژمارەی نهێنی سیستەم بنووسە"}
          </p>
        </div>

        <div className="px-6 pt-6 pb-2 -mt-6">
          {itemSummary && stage === "confirm" && (
            <div className="mx-auto bg-white rounded-xl border border-slate-200 shadow-md p-4 flex items-center gap-3">
              <div className="shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-rose-100 to-red-100 flex items-center justify-center text-rose-700 ring-1 ring-rose-200">
                <Trash2 className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <div className="flex-1 min-w-0">{itemSummary}</div>
            </div>
          )}
          {stage === "pin" && (
            <div className="mx-auto bg-white rounded-xl border border-slate-200 shadow-md p-4">
              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") submitPin(); }}
                placeholder="••••"
                className="w-full text-center text-2xl tracking-[0.7em] font-bold tabular-nums px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 outline-none"
                dir="ltr"
              />
              {error && (
                <p className="mt-3 text-center text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-md py-1.5">
                  {error}
                </p>
              )}
              <p className="mt-3 text-center text-[11px] text-slate-500">
                ژمارەی نهێنی لە بەشی ڕێکخستنەکان دادەنرێت
              </p>
            </div>
          )}

          {stage === "confirm" && (
            <p className="mt-4 text-center text-sm text-slate-700 leading-relaxed">
              دڵنیای لە سڕینەوە؟
            </p>
          )}
        </div>

        <div className="px-6 pt-5 pb-6 flex items-center gap-3" dir="ltr">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition border border-slate-200"
          >
            نەخێر
          </button>
          {stage === "confirm" ? (
            <button
              onClick={() => setStage("pin")}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
            >
              بەڵێ، بەردەوام بە
            </button>
          ) : (
            <button
              onClick={submitPin}
              disabled={verifying || !pin}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {verifying ? "پشکنین..." : "بسڕەوە"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
