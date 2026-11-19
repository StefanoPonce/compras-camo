import Link from "next/link";
import ImagenMaterial from "../imagen-material";
import BotonRequisicionesMaterial, {
  type RequisicionDelMaterial,
} from "./boton-requisiciones-material";
import {
  unidadesDe,
  type GrupoConsolidado,
  type OrdenConsolidacion,
} from "@/lib/consolidacion";
import DesgloseCantidades from "../desglose-cantidades";
import { etiquetaUnidad } from "@/lib/unidades";
import { estadoVisibleDe } from "@/lib/estado-gestion";

/** Columnas, en el orden que piden Gestión y Compras:
 *  Fecha · Imagen · Código · Material · Categoría · Unidad · Cantidad
 *  consolidada · Origen (y al final, solo en pantalla, el botón que abre la
 *  lista de requisiciones del material, que es donde se registra lo
 *  gestionado o comprado de cada solicitante). */
function fecha(d: Date) {
  return new Date(d).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}

function numero(n: number) {
  return n.toLocaleString("es-HN");
}

/** Las requisiciones del grupo que solicitan este material, con lo que pide
 *  cada una Y su propio renglón: es la lista que abre el botón del renglón y
 *  coincide con los folios de la columna "Origen". El renglón viaja en la
 *  lista porque la ventana es donde el encargado indica a quién se le
 *  gestionó (o compró), campo por campo. */
function requisicionesDelMaterial(
  ordenes: OrdenConsolidacion[],
  materialId: number,
): RequisicionDelMaterial[] {
  return ordenes
    .filter((orden) => orden.items.some((renglon) => renglon.material.id === materialId))
    .map((orden) => {
      const renglon = orden.items.find((r) => r.material.id === materialId)!;
      // Contadores del renglón, recortados al propio renglón: son los que
      // alimentan el campo de ESTE solicitante en la ventana y dicen hasta
      // cuánto puede aceptar (la cantidad pedida menos el otro contador).
      const gestionadas = Math.min(Math.max(renglon.cantidadGestionada || 0, 0), renglon.cantidad);
      const compradas = Math.min(Math.max(renglon.cantidadComprada || 0, 0), renglon.cantidad - gestionadas);
      // Las mismas reglas que actualizarConteoRenglon(): solo lo de una
      // requisición aprobada se puede mover, y un material ya inventariado
      // queda congelado. Si no, se pasa el motivo para que la ventana lo diga
      // en vez de mostrar un campo que no sirve.
      const bloqueo =
        orden.estado !== "Aprobada"
          ? "Requisición aún no aprobada"
          : renglon.inventariado
            ? "Material ya en inventario"
            : null;
      return {
        id: orden.id,
        folio: orden.folio,
        fecha: fecha(orden.fecha),
        // Se calcula con TODOS los renglones de la requisición (no solo los
        // de este material), igual que en la lista de requisiciones.
        estado: estadoVisibleDe(orden.estado, orden.items),
        solicitante: orden.solicitante.nombre,
        cantidad: renglon.cantidad,
        unidad: etiquetaUnidad(renglon.unidad || renglon.material.unidad),
        lineaId: renglon.id,
        gestionadas,
        compradas,
        bloqueo,
      };
    });
}

export default function TablaConsolidacion({
  grupos,
  campo,
}: {
  grupos: GrupoConsolidado[];
  /** Qué contador registra este módulo: el de Gestión ("Cantidad gestionada")
   *  o el de Compras ("Cantidad comprada"). No es una columna de la tabla
   *  (la tabla ya no lleva conteo): es el nombre que usa la ventana de
   *  requisiciones para el campo de cada solicitante. */
  campo: "gestionada" | "comprada";
}) {
  if (!grupos.length) return null;

  const tituloCantidad = campo === "comprada" ? "Cantidad comprada" : "Cantidad gestionada";

  return (
    <>
      {grupos.map((grupo) => (
        <section
          key={grupo.proveedor?.id ?? "sin-proveedor"}
          className="tarjeta mb-4 overflow-hidden consolidacion-grupo"
        >
          <div className="p-4 border-b border-borde">
            <div className="flex items-start gap-3 flex-wrap">
              <div>
                {grupo.proveedor && (
                  <h3 className="font-sora font-semibold text-lg">{grupo.proveedor.nombre}</h3>
                )}
                <p className="text-sm text-tinta2 mt-0.5">
                  {grupo.proveedor?.codigo ? `${grupo.proveedor.codigo} · ` : ""}
                  {grupo.ordenes.length} requisición(es) · {grupo.items.length} material(es) distinto(s)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-3 text-xs text-tinta2">
              <span>Requisiciones incluidas:</span>
              {grupo.ordenes.map((orden) => (
                <Link
                  key={orden.id}
                  href={`/ordenes/${orden.id}`}
                  className="font-mono text-verde hover:underline"
                >
                  {orden.folio}
                </Link>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            {/* Nueve columnas: la de conteo ya no existe, así que sobra el
                ancho que ocupaba. Se deja redondo para que no salga scroll
                de más en pantallas comunes. */}
            <table className="w-full tabla" style={{ minWidth: 1040 }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Imagen</th>
                  <th>Código</th>
                  <th>Material</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th className="text-right">Cantidad consolidada</th>
                  <th>Origen</th>
                  {/* Columna solo en pantalla: en papel no hay botones que
                      presionar, y la lista se ve en los folios de Origen. */}
                  <th className="no-imprimir">Requisiciones</th>
                </tr>
              </thead>
              <tbody>
                {grupo.items.map((item) => {
                  const folios = [...item.folios];
                  const requisiciones = requisicionesDelMaterial(grupo.ordenes, item.material.id);
                  return (
                    <tr key={item.material.id}>
                      <td className="whitespace-nowrap">{fecha(item.fecha)}</td>
                      <td>
                        <ImagenMaterial
                          src={item.material.imagenUrl}
                          alt={item.material.nombre}
                          className="h-10 w-10"
                        />
                      </td>
                      <td className="font-mono whitespace-nowrap">{item.material.codigo}</td>
                      <td className="[overflow-wrap:anywhere]">
                        <strong>{item.material.nombre}</strong>
                      </td>
                      <td className="[overflow-wrap:anywhere]">{item.material.categoria}</td>
                      <td>{unidadesDe(item.unidades)}</td>
                      {/* La cifra grande es lo total; debajo, en qué estado
                          del ciclo está cada unidad de eso (gestionado,
                          comprado o todavía en proceso). Sin
                          whitespace-nowrap a propósito: el desglose es texto
                          largo y tiene que poder envolverse dentro de la
                          columna. */}
                      <td className="text-right font-semibold">
                        {numero(item.cantidad)}
                        <DesgloseCantidades cantidades={item.cantidades} className="mt-0.5" />
                      </td>
                      <td>
                        {folios.length > 1 ? (
                          <span className="etiqueta et-pendiente">En {folios.length} requisiciones</span>
                        ) : (
                          <span className="font-mono text-xs">{folios.join(", ")}</span>
                        )}
                        {folios.length > 1 && (
                          <div className="text-xs text-tinta2 font-mono mt-1">{folios.join(", ")}</div>
                        )}
                      </td>
                      <td className="no-imprimir">
                        <BotonRequisicionesMaterial
                          material={{ nombre: item.material.nombre, codigo: item.material.codigo }}
                          requisiciones={requisiciones}
                          campo={campo}
                          titulo={tituloCantidad}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
