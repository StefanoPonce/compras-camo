"use client";
// Confirmación de recibo, producto por producto, hecha por el solicitante de
// la requisición cuando ya le llegó el material.
//
// Es una marca informativa: NO suma al inventario ni cambia el estado de la
// requisición (eso lo registra el sub administrador con "Registrar entrega").
// Por eso el botón solo aparece al solicitante de ESA requisición; los demás
// solo ven si ya se confirmó.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmarReciboProducto } from "../../actions";

type Props = {
  /** Renglón (detalle_orden) del producto. */
  lineaId: number;
  /** Material, para el mensaje de confirmación. */
  material: string;
  /** ¿Ya lo confirmó el solicitante? */
  confirmado: boolean;
  /** Fecha de la confirmación ya formateada; null si no hay. */
  fecha: string | null;
  /** true solo para el solicitante de esta requisición y si ya está enviada. */
  puedeMarcar: boolean;
};

export default function MarcarRecibido({ lineaId, material, confirmado, fecha, puedeMarcar }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();

  async function alternar() {
    const nuevo = !confirmado;
    if (nuevo) {
      const ok = window.confirm(
        `¿Confirmar que ya recibiste "${material}"?\n\n` +
          `Es solo el registro de que te llegó: no modifica el inventario ni el estado de la requisición.`,
      );
      if (!ok) return;
    }

    setOcupado(true);
    try {
      const resultado = await confirmarReciboProducto(lineaId, nuevo);
      if (resultado?.error) {
        alert(resultado.error);
        return;
      }
      router.refresh();
    } catch {
      alert("No se pudo guardar la confirmación. Intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  if (confirmado) {
    return (
      <span className="inline-flex items-center gap-x-1.5 gap-y-1 flex-wrap">
        <span className="etiqueta et-recibido">Recibido</span>
        {fecha && <span className="text-xs text-tinta2 whitespace-nowrap">{fecha}</span>}
        {puedeMarcar && (
          <button
            type="button"
            className="text-xs text-tinta2 underline disabled:opacity-50"
            onClick={alternar}
            disabled={ocupado}
          >
            {ocupado ? "Guardando…" : "Deshacer"}
          </button>
        )}
      </span>
    );
  }

  if (!puedeMarcar) return <span className="text-xs text-tinta2">—</span>;

  return (
    <button type="button" className="btn-secundario btn-chico" onClick={alternar} disabled={ocupado}>
      {ocupado ? "Guardando…" : "Marcar recibido"}
    </button>
  );
}
