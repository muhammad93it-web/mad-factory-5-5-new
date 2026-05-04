// Convert Eastern-Arabic (٠١٢٣٤٥٦٧٨٩) and Extended-Arabic (۰۱۲۳۴۵۶۷۸۹) digits
// to Western-Arabic (0-9) digits. Used globally so users typing on a Kurdish/Arabic
// keyboard don't have to switch languages just to type numbers.
const EASTERN_TO_WESTERN: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٫": ".", "٬": ",",
};

export function toWesternNumerals(input: string | null | undefined): string {
  if (input == null) return "";
  let out = "";
  for (const ch of input) {
    out += EASTERN_TO_WESTERN[ch] ?? ch;
  }
  return out;
}

export function hasEasternDigits(input: string | null | undefined): boolean {
  if (!input) return false;
  for (const ch of input) {
    if (ch in EASTERN_TO_WESTERN) return true;
  }
  return false;
}

/**
 * Install a global capture-phase listener that rewrites Eastern-Arabic digits
 * to Western digits in any <input> or <textarea> as the user types. Idempotent.
 */
let installed = false;
export function installGlobalNumeralNormalizer() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener(
    "input",
    (e) => {
      const t = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") return;
      // Skip non-text inputs that don't accept arbitrary characters
      if (tag === "INPUT") {
        const inp = t as HTMLInputElement;
        const type = (inp.type || "text").toLowerCase();
        if (type === "checkbox" || type === "radio" || type === "file" || type === "color" || type === "range") return;
      }
      const v = t.value;
      if (!hasEasternDigits(v)) return;
      const next = toWesternNumerals(v);
      if (next === v) return;
      // Preserve caret position when possible
      let start: number | null = null;
      let end: number | null = null;
      try {
        start = (t as HTMLInputElement).selectionStart;
        end = (t as HTMLInputElement).selectionEnd;
      } catch {
        // selection not supported on this input type — ignore
      }
      // Use the native setter so React's controlled inputs see the change and re-fire.
      const proto = tag === "INPUT" ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) {
        setter.call(t, next);
      } else {
        t.value = next;
      }
      // Re-fire React-friendly input event so onChange handlers receive the new value.
      t.dispatchEvent(new Event("input", { bubbles: true }));
      try {
        if (start != null && end != null) {
          (t as HTMLInputElement).setSelectionRange(start, end);
        }
      } catch {
        // ignore on inputs that don't support selection
      }
    },
    true,
  );
}
