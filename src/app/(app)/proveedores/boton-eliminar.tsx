"use client";
import { useTransition } from "react";
import { eliminarProveedor } from "../actions";

export default function BotonEliminarProveedor({ id, nombre }: { id: number; nombre: string }) {
  const [pendiente, iniciar] = useTransition();

  function eliminar() {
    if (!confirm(`¿Eliminar a "${nombre}" del registro?`)) return;
    iniciar(async () => {
      const datos = new FormData();
      datos.set("id", String(id));
      const resultado = await eliminarProveedor({ error: null }, datos);
      if (resultado?.error) alert(resultado.error);
    });
  }

  return (
    <button className="btn-peligro btn-chico" disabled={pendiente} onClick={eliminar}>
      {pendiente ? "…" : "Eliminar"}
    </button>
  );
}
