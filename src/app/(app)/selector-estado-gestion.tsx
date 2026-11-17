"use client";
// Control de la columna "Estado" de los módulos Gestión y Compras.
//
// Una fila de la consolidación junta varios renglones (una requisición por
// cada proveedor que pidió el material), así que el cambio se manda con todos
// los ids de esa fila y el servidor los actualiza junto.
//
// La columna muestra únicamente cuántas unidades de la fila ya lleva ese
// módulo: 2 CAFÉ MOLIDO de los cuales 1 ya se gestionó y la otra sigue en
// proceso de compra. Gestión escribe en cantidadGestionada y Compras en
// cantidadComprada, que son contadores aparte, así que lo que hace uno no
// borra lo que hizo el otro. Aquí había un desplegable que ponía TODA la fila
// en un estado; con los dos contadores quedaba duplicado, porque el
// desplegable solo podía decir "todo" o "nada" y el contador dice exactamente
// cuánto.
import { useState } from "react";
import { useRouter } from "next/navigation";
import DesgloseCantidades from "./desglose-cantidades";
import {
  actualizarCantidadComprada,
  actualizarCantidadGestionada,
} from "./actions";
import { CLASE_CICLO, ETIQUETAS_CICLO, ORDEN_CICLO, type CantidadesCiclo } from "@/lib/estado-gestion";

type CampoConteo = "gestionada" | "comprada";

type Props = {
  /** Renglones (detalle_orden) que forman la fila de la tabla. */
  lineaIds: number[];
  /** Material de la fila, para los mensajes. */
  material: string;
  /** Nombre de la columna donde vive el campo: "Cantidad gestionada" en
   *  Gestión y "Cantidad comprada" en Compras. Es el nombre accesible del
   *  campo y el texto del tooltip, que es donde queda dicho hasta cuánto se
   *  puede poner (el campo ya no lo escribe al lado). */
  titulo: string;
  /** Qué contador escribe este módulo: el de gestión o el de compras. */
  campo: CampoConteo;
  /** Unidades de la fila en cada estado del ciclo: de ahí salen las que ya
   *  trae este contador y las que todavía se pueden registrar. */
  cantidades: CantidadesCiclo;
};

export default function SelectorEstadoGestion({
  lineaIds,
  material,
  titulo,
  campo,
  cantidades,
}: Props) {
  const [ocupado, setOcupado] = useState(false);
  const router = useRouter();

  // Lo que este contador ya registra en la fila…
  const registradas = campo === "comprada" ? cantidades.Entregado : cantidades.Gestionado;
  // …y lo que todavía se puede registrar: las unidades que quedan sin
  // resolver (en proceso de gestión o de compra). Lo gestionado y lo comprado
  // no se pueden volver a contar en este mismo contador.
  const disponibles = cantidades.EnGestion + cantidades.EnCompra;

  /** Manda las unidades de la fila para ESTE contador. Va al salir del campo
   *  o al pulsar Enter, no en cada tecla: si no, se mandaría un valor a medias
   *  mientras escribe ("1" antes de llegar a "12"). */
  async function aplicar(texto: string) {
    const valor = Math.round(Number(texto));
    if (ocupado || !Number.isFinite(valor) || valor === registradas) return;

    setOcupado(true);
    try {
      const resultado =
        campo === "comprada"
          ? await actualizarCantidadComprada(lineaIds, valor)
          : await actualizarCantidadGestionada(lineaIds, valor);
      if (resultado?.error) {
        alert(resultado.error);
        return;
      }
      // El servidor puede guardar menos de lo pedido, si parte de las
      // unidades está en renglones que no se mueven (requisición que aún no
      // está aprobada, material ya en inventario o fila ya resuelta entera).
      // Se avisa en vez de dejar el campo diciendo algo que no quedó guardado.
      if (typeof resultado?.aplicadas === "number" && resultado.aplicadas < valor) {
        alert(
          `Solo se pudieron registrar ${resultado.aplicadas} de ${valor} unidad(es) en "${titulo}".\n\n` +
            `Las demás están en renglones que no se pueden mover: requisiciones que aún ` +
            `no están aprobadas, materiales ya en inventario o filas que ya quedaron completas.`,
        );
      }
      router.refresh();
    } catch {
      alert(`No se pudo actualizar "${titulo}". Intenta de nuevo.`);
    } finally {
      setOcupado(false);
    }
  }

  // La fila ya no acepta más unidades: se resolvió entera (todo gestionado,
  // todo comprado o una mezcla de los dos). En vez de un campo que no sirve,
  // se muestra el estado como etiqueta; si la fila mezcla los dos, el desglose
  // dice en qué quedó.
  if (disponibles <= 0) {
    const activos = ORDEN_CICLO.filter((estado) => cantidades[estado] > 0);
    if (activos.length === 1) {
      return <span className={"etiqueta " + CLASE_CICLO[activos[0]]}>{ETIQUETAS_CICLO[activos[0]]}</span>;
    }
    return <DesgloseCantidades cantidades={cantidades} />;
  }

  return (
    // Solo el número: el nombre lo da el encabezado de la columna
    // ("Cantidad gestionada" o "Cantidad comprada") y hasta cuánto se puede
    // poner queda en el tooltip y en el propio límite del campo.
    <input
      type="number"
      key={registradas}
      defaultValue={registradas}
      min={0}
      max={disponibles}
      step={1}
      disabled={ocupado}
      aria-label={`${titulo} de ${material}`}
      title={`${titulo} de ${material} — máximo ${disponibles}`}
      className="w-24 px-2 py-1 text-xs text-center border border-borde rounded-lg bg-superficie text-tinta disabled:opacity-60"
      onBlur={(evento) => aplicar(evento.target.value)}
      onKeyDown={(evento) => {
        if (evento.key === "Enter") {
          evento.preventDefault();
          aplicar(evento.currentTarget.value);
        }
      }}
    />
  );
}
