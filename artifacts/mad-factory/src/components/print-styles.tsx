export function PrintStyles() {
  return (
    <style>{`
      @media print {
        /* margin: 0 on @page tells the browser there is no room for its
           default header/footer (URL, page title, page number, date), so it
           omits them across Chrome/Edge/Firefox/Safari. We re-add the
           printable margin via internal padding on .print-area. */
        @page { margin: 0; size: A4; }
        html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
        .print-area { box-shadow: none !important; border: none !important; padding: 1.2cm !important; }
        .print\\:hidden { display: none !important; }
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
