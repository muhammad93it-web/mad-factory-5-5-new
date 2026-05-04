export function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { margin: 1.2cm; size: A4; }
        body { background: white !important; }
        .print\\:hidden { display: none !important; }
        .print-area { box-shadow: none !important; border: none !important; }
        .no-print { display: none !important; }

        /* Stop long unbroken text in notes from blowing up the layout. */
        .notes-cell, .notes-block {
          word-wrap: break-word !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          white-space: pre-wrap !important;
          max-width: 100%;
          overflow: hidden;
        }
        /* Make sure invoice tables respect column widths even with long content. */
        .print-area table { table-layout: fixed; width: 100%; }
        .print-area td, .print-area th { overflow-wrap: anywhere; word-break: break-word; }
      }

      /* Apply the same word-break rules on screen too, so the preview matches print. */
      .notes-cell, .notes-block {
        word-wrap: break-word;
        overflow-wrap: anywhere;
        word-break: break-word;
        white-space: pre-wrap;
        max-width: 100%;
      }
    `}</style>
  );
}
