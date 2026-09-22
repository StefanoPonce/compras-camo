"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolverOrden, recibirOrden } from "../../actions";

export default function BotonesAdmin({ id, estado }: { id: number; estado: string }) {
  const [comentario, setComentario] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();

  async function resolver(nuevo: "Aprobada" | "Rechazada") {
    if (nuevo === "Rechazada" && !comentario.trim()) {
      alert("Escribe el motivo del rechazo antes de continuar.");
      return;
    }
    setOcupado(true);
    try {
      await resolverOrden(id, nuevo, comentario.trim());
      router.refresh();
    } catch {
      alert("No se pudo actualizar la orden. Intenta de nuevo.");
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
      alert("No se pudo marcar como recibida. Intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "Pendiente") {
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
  if (estado === "Aprobada") {
    return (
      <div className="flex justify-end mt-4">
        <button disabled={ocupado} className="btn" onClick={recibir}>Marcar como recibida</button>
      </div>
    );
  }
  return null;
}
