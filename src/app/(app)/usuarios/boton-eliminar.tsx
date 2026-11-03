"use client";
import { useTransition } from "react";
import { eliminarUsuario } from "../actions";

export default function BotonEliminarUsuario({ id, nombre }: { id: number; nombre: string }) {
  const [pendiente, iniciar] = useTransition();

  function eliminar() {
    if (!confirm(`¿Eliminar la cuenta de "${nombre}"? Esta acción no se puede deshacer.`)) return;
    iniciar(async () => {
      const datos = new FormData();
      datos.set("id", String(id));
      const resultado = await eliminarUsuario({ error: null }, datos);
      if (resultado?.error) alert(resultado.error);
      else if (resultado?.exito) alert(resultado.exito);
    });
  }

  return (
    <button className="btn-peligro btn-chico" disabled={pendiente} onClick={eliminar}>
      {pendiente ? "…" : "Eliminar"}
    </button>
  );
}
