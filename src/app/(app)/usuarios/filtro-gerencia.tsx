"use client";

import { useRouter } from "next/navigation";
import { DEPENDENCIAS, SIN_AREA_ASIGNADA } from "@/lib/dependencias";

/** Desplegable que filtra la lista de usuarios por gerencia.
 *
 *  Vive en el módulo Usuarios, que solo el administrador del sistema puede
 *  abrir, así que este filtro también queda en manos del administrador: sirve
 *  para ver de un vistazo quién pertenece a cada gerencia.
 *
 *  Cambiar la selección navega con `?area=…` y la página del servidor es la
 *  que filtra; no hay que apretar ningún botón. Elegir "Todas" quita el
 *  parámetro y devuelve la lista completa. */
export default function FiltroGerencia({ valor }: { valor: string }) {
  const router = useRouter();

  return (
    <select
      id="filtro-gerencia"
      className="campo-input"
      value={valor}
      onChange={(evento) => {
        const elegido = evento.target.value;
        router.replace(elegido ? `/usuarios?area=${encodeURIComponent(elegido)}` : "/usuarios");
      }}
    >
      <option value="">Todas las gerencias</option>
      <option value={SIN_AREA_ASIGNADA}>Sin gerencia asignada</option>
      {DEPENDENCIAS.map((d) => (
        <option key={d.valor} value={d.valor}>{d.etiqueta}</option>
      ))}
    </select>
  );
}
