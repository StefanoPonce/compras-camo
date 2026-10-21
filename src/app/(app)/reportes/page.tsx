import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { puede, puedeVerModulo } from "@/lib/permisos";
import { fecha, hoy, obtenerReporte, primerDiaDelMes } from "@/lib/reportes";
import BotonImprimir from "./boton-imprimir";
import BotonExportarExcel from "../boton-exportar-excel";
import Image from "next/image";


export default async function Reportes({
  searchParams,
}: { searchParams: { desde?: string; hasta?: string; estado?: string; reporte?: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "reportes")) redirect("/");
  if (!puede(sesion.user.rol, "reportes.ver")) redirect("/");

  const desde = searchParams.desde || primerDiaDelMes();
  const hasta = searchParams.hasta || hoy();
  const estadoParam = searchParams.estado || "AR";
  const reporte = searchParams.reporte === "insumos" ? "insumos" : "gestionado";
  const esGestionado = reporte === "gestionado";

  // El Excel se arma con los mismos filtros que se están viendo en pantalla.
  const exportarHref =
    `/reportes/exportar?${new URLSearchParams({
      reporte,
      desde,
      hasta,
      estado: estadoParam,
    }).toString()}`;

  const {
    ordenes,
    filasEstado,
    filasProveedor,
    filasMaterial,
    filasCategoria,
    unidadesCompradas,
  } = await obtenerReporte({ desde, hasta, estado: estadoParam });

  const generado = new Date().toLocaleString("es-HN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <>
      <div className="hidden solo-impresion mb-6">
           <div className="flex justify-center mb-1">
                       <Image
                          src="/logo-camo.png"
                          alt="Logo Fundación CAMO"
                          width={150}
                          height={150}
                          priority
                        />
                     </div>
        <div className="text-lg font-sora font-semibold">Fundación CAMO</div>
        <div className="text-tinta2 text-sm">
          {esGestionado ? "Reporte de gestión de compras" : "Reporte de insumos comprados"}
        </div>
        <div className="text-tinta2 text-xs mt-1">
          Del {fecha(desde)} al {fecha(hasta)} · Generado el {generado} por {sesion.user.name}
        </div>
        <hr className="my-3 border-borde" />
      </div>

      <div className="flex items-start gap-3 flex-wrap mb-4 no-imprimir">
        <div>
          <h2 className="text-xl font-sora font-semibold">Reportes</h2>
          {esGestionado ? (
            <p className="text-tinta2 text-sm mt-1 max-w-[62ch]">
              Visión de la gestión de compras: requisiciones por estado y materiales agrupados por proveedor, para el período que elijas.
            </p>
          ) : (
            <p className="text-tinta2 text-sm mt-1 max-w-[62ch]">
              Detalle de los insumos y materiales comprados en el período, por material y por categoría.
            </p>
          )}
        </div>
        <div className="ml-auto flex gap-2 flex-wrap items-center">
          <BotonExportarExcel href={exportarHref} texto="Exportar a Excel" />
          <BotonImprimir />
        </div>
      </div>

      <form className="flex gap-2 flex-wrap items-end mb-6 no-imprimir" action="/reportes">
        <div>
          <label className="block text-xs text-tinta2 mb-1">Tipo de reporte</label>
          <select className="campo-input" name="reporte" defaultValue={reporte}>
            <option value="gestionado">Gestionado</option>
            <option value="insumos">Insumos comprados</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-tinta2 mb-1">Desde</label>
          <input className="campo-input" type="date" name="desde" defaultValue={desde} />
        </div>
        <div>
          <label className="block text-xs text-tinta2 mb-1">Hasta</label>
          <input className="campo-input" type="date" name="hasta" defaultValue={hasta} />
        </div>
        <div>
          <label className="block text-xs text-tinta2 mb-1">Requisiciones a incluir</label>
          <select className="campo-input" name="estado" defaultValue={estadoParam}>
            <option value="AR">Aprobadas y entregadas</option>
            <option value="todas">Todas (incluye pendientes y rechazadas)</option>
            <option value="Pendiente">Solo pendientes</option>
            <option value="Aprobada">Solo aprobadas</option>
            <option value="Rechazada">Solo rechazadas</option>
            <option value="Recibida">Solo entregadas</option>
          </select>
        </div>
        <button className="btn-secundario">Aplicar</button>
      </form>

      {esGestionado ? (
        <>
          <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))" }}>
            <div className="tarjeta p-4">
              <div className="font-sora text-2xl font-semibold">{unidadesCompradas}</div>
              <div className="text-sm text-tinta2 mt-1">Unidades en el período</div>
            </div>
            <div className="tarjeta p-4">
              <div className="font-sora text-2xl font-semibold">{ordenes.length}</div>
              <div className="text-sm text-tinta2 mt-1">Requisiciones incluidas</div>
            </div>
            <div className="tarjeta p-4">
              <div className="font-sora text-2xl font-semibold">{filasProveedor.length}</div>
              <div className="text-sm text-tinta2 mt-1">Proveedores distintos</div>
            </div>
          </div>

          <h3 className="text-base font-sora font-semibold mb-2.5">Requisiciones por estado</h3>
          <div className="tarjeta overflow-x-auto mb-6">
            <table className="w-full tabla" style={{ minWidth: 360 }}>
              <thead><tr><th>Estado</th><th className="text-right">Requisiciones</th><th className="text-right">Unidades</th></tr></thead>
              <tbody>
                {filasEstado.map((f) => (
                  <tr key={f.estado}>
                    <td><span className={"etiqueta et-" + (f.estado === "Entregada" ? "recibida" : f.estado.toLowerCase())}>{f.estado}</span></td>
                    <td className="text-left">{f.cant}</td>
                    <td className="text-left">{f.unidades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-sora font-semibold mb-2.5">Materiales por proveedor</h3>
          {filasProveedor.length ? (
            <div className="tarjeta overflow-x-auto mb-6">
              <table className="w-full tabla" style={{ minWidth: 480 }}>
                <thead><tr><th>Proveedor</th><th className="text-right">Requisiciones</th><th className="text-right">Materiales distintos</th><th className="text-right">Unidades</th><th className="text-right">% de las unidades</th></tr></thead>
                <tbody>
                  {filasProveedor.map((p) => (
                    <tr key={p.nombre}>
                      <td>{p.nombre}</td>
                      <td className="text-left">{p.ordenes}</td>
                      <td className="text-left">{p.materiales}</td>
                      <td className="text-left">{p.unidades}</td>
                      <td className="text-left">{unidadesCompradas ? ((p.unidades / unidadesCompradas) * 100).toFixed(1) : "0.0"}%</td>
                    </tr>
                  ))}
                  <tr><td className="font-semibold">Total</td><td className="text-left font-semibold">{ordenes.length}</td><td className="text-left font-semibold">{filasMaterial.length}</td><td className="text-left font-semibold">{unidadesCompradas}</td><td></td></tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="tarjeta p-10 text-center text-tinta2 mb-6">No hay compras en ese período con ese filtro.</div>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))" }}>
            <div className="tarjeta p-4">
              <div className="font-sora text-2xl font-semibold">{unidadesCompradas}</div>
              <div className="text-sm text-tinta2 mt-1">Unidades compradas</div>
            </div>
            <div className="tarjeta p-4">
              <div className="font-sora text-2xl font-semibold">{filasMaterial.length}</div>
              <div className="text-sm text-tinta2 mt-1">Materiales distintos</div>
            </div>
            <div className="tarjeta p-4">
              <div className="font-sora text-2xl font-semibold">{unidadesCompradas}</div>
              <div className="text-sm text-tinta2 mt-1">Unidades compradas</div>
            </div>
          </div>

          <h3 className="text-base font-sora font-semibold mb-2.5">Insumos comprados por material</h3>
          {filasMaterial.length ? (
            <div className="tarjeta overflow-x-auto mb-6">
              <table className="w-full tabla" style={{ minWidth: 560 }}>
                <thead><tr><th>Código</th><th>Material</th><th>Categoría</th><th>Unidad</th><th className="text-right">Cantidad</th><th className="text-right">Requisiciones</th></tr></thead>
                <tbody>
                  {filasMaterial.map((m) => (
                    <tr key={m.material.id}>
                      <td className="font-mono">{m.material.codigo}</td>
                      <td>{m.material.nombre}</td>
                      <td>{m.material.categoria}</td>
                      <td>{m.unidades}</td>
                      <td className="text-right">{m.cantidad}</td>
                      <td className="text-right">{m.requisiciones}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="font-semibold" colSpan={4}>Total</td>
                    <td className="text-right font-semibold">{unidadesCompradas}</td>
                    <td className="text-right font-semibold">{ordenes.length}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="tarjeta p-10 text-center text-tinta2 mb-6">No hay insumos comprados en ese período con ese filtro.</div>
          )}

          <h3 className="text-base font-sora font-semibold mb-2.5">Por categoría de material</h3>
          {filasCategoria.length ? (
            <div className="tarjeta overflow-x-auto">
              <table className="w-full tabla" style={{ minWidth: 480 }}>
                <thead><tr><th>Categoría</th><th className="text-right">Unidades compradas</th><th className="text-right">Materiales distintos</th></tr></thead>
                <tbody>
                  {filasCategoria.map((c) => (
                    <tr key={c.categoria}>
                      <td>{c.categoria}</td>
                      <td className="text-right">{c.cantidad}</td>
                      <td className="text-right">{c.materiales}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="tarjeta p-10 text-center text-tinta2">No hay materiales comprados en ese período.</div>
          )}
        </>
      )}
    </>
  );
}
