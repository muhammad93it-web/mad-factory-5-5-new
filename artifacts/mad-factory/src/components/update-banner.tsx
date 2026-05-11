import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export function UpdateBanner() {
  const [worker, setWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const sw = (e as CustomEvent<{ worker: ServiceWorker }>).detail?.worker;
      if (sw) {
        setWorker(sw);
        setDismissed(false);
      }
    };
    window.addEventListener("mf:update-available", onUpdate);
    return () => window.removeEventListener("mf:update-available", onUpdate);
  }, []);

  if (!worker || dismissed) return null;

  const apply = () => {
    worker.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div className="bg-emerald-600 text-white px-6 py-2 flex items-center justify-between gap-4 print:hidden" dir="rtl">
      <div className="flex items-center gap-2 text-sm">
        <Download className="h-4 w-4" />
        <span>وەشانی نوێی ئەپ بەردەستە</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={apply}
          className="bg-white text-emerald-700 px-3 py-1 rounded text-xs font-bold hover:opacity-90"
        >
          نوێکردنەوە
        </button>
        <button onClick={() => setDismissed(true)} className="p-1 hover:bg-white/10 rounded">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
