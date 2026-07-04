"use client";

/**
 * "Versión imprimible": dispara el diálogo de impresión del navegador.
 * El layout limpio A4 lo aplican las reglas @media print de globals.css
 * (oculta header y elementos `no-print` / `print:hidden`).
 */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-pill bg-carbon px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black"
    >
      🖨 Versión imprimible
    </button>
  );
}
