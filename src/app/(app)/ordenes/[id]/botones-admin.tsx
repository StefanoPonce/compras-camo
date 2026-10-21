"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolverOrden, recibirOrden } from "../../actions";

/** Botones de revisión: autorizar (aprobar/rechazar) y recibir.
 *  Cada grupo se muestra según el permiso que traiga el rol en sesión. */
export default function BotonesOrden({
  id,
  folio,
  estado,
  puedeAutorizar,
  puedeRecibir,
}: {
  id: number;
  folio: string;
  estado: string;
  puedeAutorizar: boolean;
  puedeRecibir: boolean;
}) {
  const [comentario, setComentario] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();

  async function resolver(nuevo: "Aprobada" | "Rechazada") {
    if (nuevo === "Rechazada" && !comentario.trim()) {
      alert("Escribe el motivo del rechazo antes de continuar.");
      return;
    }
    // Aprobar o rechaza deja rastro en la requisición y notifica al
    // solicitante, así que se pide confirmación antes de hacerlo.
    const ok = window.confirm(
      nuevo === "Rechazada"
        ? `¿Seguro que quieres rechazar la requisición ${folio}?\n\nQuedará en estado Rechazada y el solicitante verá el motivo que escribiste.`
        : `¿Seguro que quieres aprobar la requisición ${folio}?\n\nQuedará en estado Aprobada y desde ahí se podrá marcar como recibida.`
    );
    if (!ok) return;
    setOcupado(true);
    try {
      await resolverOrden(id, nuevo, comentario.trim());
      router.refresh();
    } catch {
      alert("No se pudo actualizar la requisición. Intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  async function recibir() {
    setOcupado(true);
    try {
      await recibirOrden(id);
      router.refresh();
    } catch {
      alert("No se pudo registrar la entrega. Intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "Pendiente" && puedeAutorizar) {
    return (
      <div className="tarjeta p-4 mt-4">
        <label className="block text-sm text-tinta2 mb-1.5 font-medium">Comentario (obligatorio para rechazar)</label>
        <textarea className="campo-input mb-3" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        <div className="flex gap-2 justify-end">
          <button disabled={ocupado} className="btn-peligro" onClick={() => resolver("Rechazada")}>Rechazar</button>
          <button disabled={ocupado} className="btn" onClick={() => resolver("Aprobada")}>Aprobar</button>
        </div>
      </div>
    );
  }
  if (estado === "Aprobada" && puedeRecibir) {
    return (
      <div className="flex justify-end mt-4">
        {/* Registrar la entrega deja el nombre de este usuario en el recuadro
            "Entregado por" de la requisición impresa. */}
        <button disabled={ocupado} className="btn" onClick={recibir}>Registrar entrega</button>
      </div>
    );
  }
  return null;
}
