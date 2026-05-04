/**
 * Export an HTML <table> element (or any HTML string with a table)
 * to an Excel-compatible .xls file. Excel opens HTML tables natively
 * with full RTL/Arabic-Kurdish text support, no extra deps required.
 */
export function exportTableToExcel(filename: string, html: string) {
  const document = `<!DOCTYPE html>
<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
  <meta charset="UTF-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Sheet1</x:Name>
          <x:WorksheetOptions>
            <x:DisplayRightToLeft/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    table { border-collapse: collapse; direction: rtl; }
    th, td { border: 1px solid #999; padding: 6px 8px; text-align: right; font-family: Arial, sans-serif; }
    th { background: #f3f4f6; font-weight: bold; }
  </style>
</head>
<body>${html}</body>
</html>`;
  const blob = new Blob(["\uFEFF" + document], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function buildInvoiceTableHtml(opts: {
  title: string;
  meta: Array<[string, string]>;
  itemHeaders: string[];
  itemRows: Array<Array<string | number>>;
  totals: Array<[string, string]>;
}): string {
  const { title, meta, itemHeaders, itemRows, totals } = opts;
  const metaRows = meta.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("");
  const itemHead = itemHeaders.map((h) => `<th>${h}</th>`).join("");
  const itemBody = itemRows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");
  const totalsRows = totals
    .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
    .join("");
  return `
    <h2>${title}</h2>
    <h3>زانیاری گشتی</h3>
    <table>${metaRows}</table>
    <h3>بڕگەکان</h3>
    <table><thead><tr>${itemHead}</tr></thead><tbody>${itemBody}</tbody></table>
    <h3>کۆتایی پارەدان</h3>
    <table>${totalsRows}</table>
  `;
}
