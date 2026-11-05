"use client";
// Selector de la columna "Estado" de los módulos Gestión y Compras.
//
// Una fila de la consolidación junta varios renglones (una requisición por
// cada proveedor que pidió el material), así que el cambio se manda con todos
// los ids de esa fila y el servidor los actualiza junto.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarEstadoGestion } from "./actions";
import {
  ETIQUETAS_GESTION,
  type EstadoGestion,
} from "@/lib/estado-gestion";

type Props = {
  /** Renglones (detalle_orden) que forman la fila de la tabla. */
  lineaIds: number[];
  /** Estado que muestra la fila hoy (el combinado de sus renglones). */
  estado: EstadoGestion;
  /** Estados que se pueden elegir en la columna Estado. Hoy Gestión y
   *  Compras ofrecen los mismos dos; "Entregado" ya no se elige, pero si una
   *  fila todavía lo trae se muestra para poder cambiarlo. */
  opciones: EstadoGestion[];
  /** Material de la fila, para el mensaje de confirmación y el aria-label. */
  material: string;
};

export default function SelectorEstadoGestion({ lineaIds, estado, opciones, material }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();

  async function cambiar(nuevo: EstadoGestion) {
    if (ocupado || nuevo === estado) return;

    // Entregar puede cerrar una requisición entera, así que se confirma antes.
    if (nuevo === "Entregado") {
      const ok = window.confirm(
        `¿Marcar "${material}" como ENTREGADO?\n\n` +
          `Si todos los materiales de una requisición quedan entregados, esa requisición ` +
          `pasará sola a Recibida y faltará registrar el nombre de quien recibió la entrega.`,
      );
      if (!ok) return;
    }

    setOcupado(true);
    try {
      const resultado = await actualizarEstadoGestion(lineaIds, nuevo);
      if (resultado?.error) {
        alert(resultado.error);
        return;
      }
      router.refresh();
    } catch {
      alert("No se pudo actualizar el estado. Intenta de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <select
      className="campo-input px-2 py-1 text-xs"
      value={estado}
      disabled={ocupado}
      aria-label={`Estado de compra de ${material}`}
      onChange={(evento) => cambiar(evento.target.value as EstadoGestion)}
    >
      {/* Si la fila ya trae un estado que este módulo no ofrece (por ejemplo
          un renglón marcado como ENTREGADO antes de que se quitara esa
          opción), se agrega a la lista para que el desplegable muestre lo que
          realmente hay y se pueda cambiar. */}
      {(opciones.includes(estado) ? opciones : [estado, ...opciones]).map((opcion) => (
        <option key={opcion} value={opcion}>
          {ETIQUETAS_GESTION[opcion]}
        </option>
      ))}
    </select>
  );
}
