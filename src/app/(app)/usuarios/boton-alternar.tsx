"use client";
import { useTransition } from "react";
import { alternarUsuario } from "../actions";

export default function BotonAlternarUsuario({ id, activo }: { id: number; activo: boolean }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      className="btn-secundario btn-chico"
      disabled={pendiente}
      onClick={() => iniciar(async () => { await alternarUsuario(id); })}
    >
      {pendiente ? "…" : activo ? "Desactivar" : "Activar"}
    </button>
  );
}
