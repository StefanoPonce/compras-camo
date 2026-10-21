"use client";
// Botón de "Exportar a PDF" de los listados. Abre el diálogo de impresión del
// navegador con el listado ya maquetado (el CSS de globals.css se encarga de
// ocultar el menú y los botones), así que "Guardar como PDF" queda a una
// palabra de distancia. Es el mismo camino que usa el módulo Reportes.
export default function BotonPdf({ texto = "Exportar a PDF" }: { texto?: string }) {
  return (
    <button type="button" className="btn-secundario no-imprimir whitespace-nowrap" onClick={() => window.print()}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="17"
        height="17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9V3h12v6" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6z" />
      </svg>
      {texto}
    </button>
  );
}
