import Link from "next/link";
import ImagenMaterial from "../imagen-material";
import SelectorEstadoGestion from "../selector-estado-gestion";
import BotonRequisicionesMaterial, {
  type RequisicionDelMaterial,
} from "./boton-requisiciones-material";
import {
  unidadesDe,
  type GrupoConsolidado,
  type OrdenConsolidacion,
} from "@/lib/consolidacion";
import { estadoDeFila, type EstadoGestion } from "@/lib/estado-gestion";
import { etiquetaUnidad } from "@/lib/unidades";

/** Columnas, en el orden que piden Gestión y Compras:
 *  Fecha · Imagen · Código · Material · Categoría · Unidad · Cantidad
 *  consolidada · Origen · Estado (y al final, solo en pantalla, el botón que
 *  abre la lista de requisiciones del material). */
function fecha(d: Date) {
  return new Date(d).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}

function numero(n: number) {
  return n.toLocaleString("es-HN");
}

/** Las requisiciones del grupo que solicitan este material, con lo que pide
 *  cada una: es la lista que abre el botón del renglón y coincide con los
 *  folios de la columna "Origen". */
function requisicionesDelMaterial(
  ordenes: OrdenConsolidacion[],
  materialId: number,
): RequisicionDelMaterial[] {
  return ordenes
    .filter((orden) => orden.items.some((renglon) => renglon.material.id === materialId))
    .map((orden) => {
      const renglon = orden.items.find((r) => r.material.id === materialId)!;
      return {
        id: orden.id,
        folio: orden.folio,
        fecha: fecha(orden.fecha),
        estado: orden.estado,
        solicitante: orden.solicitante.nombre,
        cantidad: renglon.cantidad,
        unidad: etiquetaUnidad(renglon.unidad || renglon.material.unidad),
      };
    });
}

export default function TablaConsolidacion({
  grupos,
  opciones,
}: {
  grupos: GrupoConsolidado[];
  /** Estados que deja elegir la columna Estado (los de Gestión o los de Compras). */
  opciones: EstadoGestion[];
}) {
  if (!grupos.length) return null;

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
                  <th>Estado</th>
                  {/* Columna solo en pantalla: en papel no hay botones que
                      presionar, y la lista se ve en los folios de Origen. */}
                  <th className="no-imprimir">Requisiciones</th>
                </tr>
              </thead>
              <tbody>
                {grupo.items.map((item) => {
                  const folios = [...item.folios];
                  const requisiciones = requisicionesDelMaterial(grupo.ordenes, item.material.id);
                  const estado = estadoDeFila(item.estados);
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
                      <td className="text-right font-semibold whitespace-nowrap">
                        {numero(item.cantidad)}
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
                      <td>
                        <SelectorEstadoGestion
                          lineaIds={item.lineaIds}
                          estado={estado}
                          opciones={opciones}
                          material={item.material.nombre}
                        />
                      </td>
                      <td className="no-imprimir">
                        <BotonRequisicionesMaterial
                          material={{ nombre: item.material.nombre, codigo: item.material.codigo }}
                          requisiciones={requisiciones}
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
