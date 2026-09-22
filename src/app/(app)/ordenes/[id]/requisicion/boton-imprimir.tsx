"use client";
export default function BotonImprimirRequisicion() {
  return (
    <button className="btn no-imprimir" onClick={() => window.print()}>
      Imprimir / Guardar como PDF
    </button>
  );
}
