"use client";
import { useTransition } from "react";
import { eliminarMaterial } from "../actions";

export default function BotonEliminarMaterial({ id, nombre }: { id: number; nombre: string }) {
  const [pendiente, iniciar] = useTransition();

  function eliminar() {
    if (!confirm(`¿Eliminar "${nombre}" del catálogo?`)) return;
    iniciar(async () => {
      const datos = new FormData();
      datos.set("id", String(id));
      const resultado = await eliminarMaterial({ error: null }, datos);
      if (resultado?.error) alert(resultado.error);
    });
  }

  return (
    <button className="btn-peligro btn-chico" disabled={pendiente} onClick={eliminar}>
      {pendiente ? "…" : "Eliminar"}
    </button>
  );
}
