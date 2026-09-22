"use client";
// Solo dispara la impresión del navegador. El CSS en globals.css se
// encarga de ocultar el menú y el formulario, dejando solo el reporte
// — así "Guardar como PDF" desde el diálogo de impresión queda limpio.
export default function BotonImprimir() {
  return (
    <button className="btn no-imprimir" onClick={() => window.print()}>
      Imprimir / Guardar como PDF
    </button>
  );
}
