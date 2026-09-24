import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  FILTROS_CONSOLIDACION,
  normalizarFiltroConsolidacion,
  obtenerConsolidacion,
} from "@/lib/consolidacion";
import { puede, puedeVerModulo } from "@/lib/permisos";
import BotonExportarExcel from "../../boton-exportar-excel";
import BotonImprimir from "../../reportes/boton-imprimir";

function lps(n: number) {
  return "L " + n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numero(n: number) {
  return n.toLocaleString("es-HN");
}

function claseEstado(estado: string) {
  return "et-" + estado.toLowerCase();
}

function Indicador({ valor, texto, alerta }: { valor: string | number; texto: string; alerta?: boolean }) {
  return (
    <div className="tarjeta p-4">
      <div className={"font-sora text-2xl font-semibold " + (alerta ? "text-rojo" : "")}>{valor}</div>
      <div className="text-sm text-tinta2 mt-1">{texto}</div>
    </div>
  );
}

export default async function Consolidacion({
  searchParams,
}: {
  searchParams: { estado?: string; q?: string };
}) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "gestion")) redirect("/");
  if (!puede(sesion.user.rol, "consolidacion.ver")) redirect("/");

  const filtro = normalizarFiltroConsolidacion(searchParams.estado);
  const q = searchParams.q || "";
  const { ordenes, grupos } = await obtenerConsolidacion({ filtro, q });

  const totalRenglones = ordenes.reduce((suma, orden) => suma + orden.items.length, 0);
  const totalMateriales = grupos.reduce((suma, grupo) => suma + grupo.items.length, 0);
  const renglonesRepetidos = Math.max(0, totalRenglones - totalMateriales);
  const totalGeneral = grupos.reduce((suma, grupo) => suma + grupo.total, 0);
  const nombreFiltro = FILTROS_CONSOLIDACION.find((opcion) => opcion.valor === filtro)?.etiqueta || "Aprobadas";
  const generado = new Date().toLocaleString("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const exportarParams = new URLSearchParams({ estado: filtro });
  if (q.trim()) exportarParams.set("q", q.trim());
  const exportarHref = `/gestion/consolidacion/exportar?${exportarParams.toString()}`;

  return (
    <>
      <div className="solo-impresion mb-5">
        <div className="flex items-center gap-3 border-b border-borde pb-3">
          <Image src="/logo-camo.png" alt="Logo Fundación CAMO" width={52} height={52} />
          <div>
            <div className="font-sora font-semibold">Fundación CAMO</div>
            <h1 className="font-sora text-xl font-semibold">Consolidación de compras</h1>
            <div className="text-xs text-tinta2 mt-1">
              Requisiciones: {nombreFiltro} · Generado el {generado}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4 text-sm">
          <div><span className="text-tinta2">Requisiciones:</span> <strong>{ordenes.length}</strong></div>
          <div><span className="text-tinta2">Proveedores:</span> <strong>{grupos.length}</strong></div>
          <div><span className="text-tinta2">Renglones:</span> <strong>{totalRenglones}</strong></div>
          <div><span className="text-tinta2">Total estimado:</span> <strong>{lps(totalGeneral)}</strong></div>
        </div>
      </div>

      <div className="flex items-start gap-3 flex-wrap mb-4 no-imprimir">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-verde mb-1">Módulo de gestión</div>
          <h2 className="text-xl font-sora font-semibold">Consolidación de compras</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[68ch]">
            Reúne las requisiciones por proveedor para revisar y preparar una compra consolidada. Esta vista no modifica
            ni elimina las requisiciones originales.
          </p>
        </div>
        <div className="ml-auto self-center flex gap-2 flex-wrap">
          <BotonImprimir />
          <BotonExportarExcel href={exportarHref} texto="Exportar consolidado" />
        </div>
      </div>

      <form className="flex gap-2 flex-wrap items-center mb-6 no-imprimir" action="/gestion/consolidacion">
        <input
          className="campo-input max-w-xs"
          type="search"
          name="q"
          placeholder="Buscar folio, proveedor o material"
          defaultValue={q}
        />
        <select className="campo-input max-w-[260px]" name="estado" defaultValue={filtro}>
          {FILTROS_CONSOLIDACION.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>{opcion.etiqueta}</option>
          ))}
        </select>
        <button className="btn-secundario">Aplicar</button>
        {q && <Link href={`/gestion/consolidacion?estado=${filtro}`} className="btn-secundario">Limpiar</Link>}
      </form>

      <div
        className="grid gap-3.5 mb-6 no-imprimir"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(175px,1fr))" }}
      >
        <Indicador valor={ordenes.length} texto="Requisiciones a consolidar" />
        <Indicador valor={grupos.length} texto="Proveedores" />
        <Indicador valor={totalRenglones} texto="Renglones" />
        <Indicador
          valor={renglonesRepetidos}
          texto="Renglones repetidos"
          alerta={renglonesRepetidos > 0}
        />
        <Indicador valor={lps(totalGeneral)} texto="Total estimado" />
      </div>

      <div className="tarjeta p-3.5 mb-4 text-sm text-tinta2 no-imprimir">
        <strong className="text-tinta">Cómo se consolida:</strong> se suman las cantidades del mismo material cuando
        existen en varias requisiciones del mismo proveedor. Se muestra el promedio de precios y el subtotal de cada
        material. Las requisiciones pendientes solo aparecen cuando seleccionas esa opción.
      </div>

      {grupos.length ? (
        <>
          {grupos.map((grupo) => {
            const estados = [...new Set(grupo.ordenes.map((orden) => orden.estado))];
            return (
              <section key={grupo.proveedor.id} className="tarjeta mb-4 overflow-hidden consolidacion-grupo">
                <div className="p-4 border-b border-borde">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div>
                      <h3 className="font-sora font-semibold text-lg">{grupo.proveedor.nombre}</h3>
                      <p className="text-sm text-tinta2 mt-0.5">
                        {grupo.proveedor.codigo ? `${grupo.proveedor.codigo} · ` : ""}
                        {grupo.ordenes.length} requisición(es) · {grupo.items.length} material(es) distinto(s)
                      </p>
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {estados.map((estado) => (
                          <span key={estado} className={"etiqueta " + claseEstado(estado)}>{estado}</span>
                        ))}
                      </div>
                    </div>
                    <div className="ml-auto text-right">
                      <div className="text-xs text-tinta2">Total estimado del proveedor</div>
                      <div className="font-sora text-xl font-semibold text-verde mt-0.5">{lps(grupo.total)}</div>
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
                  <table className="w-full tabla" style={{ minWidth: 900 }}>
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Variante</th>
                        <th>Unidad</th>
                        <th className="text-right">Cantidad consolidada</th>
                        <th className="text-right">Precio promedio</th>
                        <th className="text-right">Subtotal</th>
                        <th>Origen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.items.map((item) => {
                        const folios = [...item.folios];
                        const precioPromedio = item.cantidad ? item.total / item.cantidad : 0;
                        return (
                          <tr key={item.material.id}>
                            <td>
                              <strong>{item.material.nombre}</strong>
                              <div className="text-xs text-tinta2 font-mono mt-0.5">{item.material.codigo}</div>
                            </td>
                            <td>{item.material.variante || "—"}</td>
                            <td>{item.material.unidad}</td>
                            <td className="text-right font-semibold">{numero(item.cantidad)}</td>
                            <td className="text-right">{lps(precioPromedio)}</td>
                            <td className="text-right font-semibold">{lps(item.total)}</td>
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          <div className="tarjeta p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-sora font-semibold">Total estimado consolidado</div>
              <div className="text-xs text-tinta2 mt-1">
                {ordenes.length} requisición(es) en {grupos.length} proveedor(es)
              </div>
            </div>
            <div className="font-sora text-2xl font-semibold text-verde">{lps(totalGeneral)}</div>
          </div>
        </>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">
          No hay requisiciones {filtro === "aprobadas" ? "aprobadas" : filtro === "pendientes" ? "pendientes" : "pendientes o aprobadas"} para consolidar con este filtro.
        </div>
      )}
    </>
  );
}
