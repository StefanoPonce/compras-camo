import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo } from "@/lib/permisos";
import { unidadesDe } from "@/lib/consolidacion";
import BotonImprimir from "./boton-imprimir";
import Image from "next/image";


function fecha(d: Date | string) {
  return new Date(d).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}
function primerDiaDelMes() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function hoy() {
  return new Date().toISOString().slice(0, 10);
}

const ESTADOS_VALIDOS = ["Pendiente", "Aprobada", "Rechazada", "Recibida"] as const;

// En los reportes el estado "Recibida" se muestra como "Entregada".
function nombreEstado(e: string) {
  return e === "Recibida" ? "Entregada" : e;
}

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

  // "todas" son todas las requisiciones jugables. Borrador nunca entra a los
// reportes: es un trabajo a medias que todavía no se ha enviado.
let estados: string[] = [...ESTADOS_VALIDOS];
  if (estadoParam === "AR") estados = ["Aprobada", "Recibida"];
  else if ((ESTADOS_VALIDOS as readonly string[]).includes(estadoParam)) estados = [estadoParam];

  const ordenes = await prisma.ordenCompra.findMany({
    where: {
      fecha: { gte: new Date(desde + "T00:00:00"), lte: new Date(hasta + "T23:59:59") },
      ...(estados ? { estado: { in: estados as ("Pendiente" | "Aprobada" | "Rechazada" | "Recibida")[] } } : {}),
    },
    include: { proveedor: true, items: { include: { material: true } } },
    orderBy: { fecha: "asc" },
  });

  // Unidades por estado: cada renglón aporta las unidades que pide la orden.
  const unidadesDeLaOrden = (o: (typeof ordenes)[number]) => o.items.reduce((s, it) => s + it.cantidad, 0);

  const porEstado = new Map<string, { cant: number; unidades: number }>();
  for (const o of ordenes) {
    const actual = porEstado.get(o.estado) || { cant: 0, unidades: 0 };
    actual.cant += 1;
    actual.unidades += unidadesDeLaOrden(o);
    porEstado.set(o.estado, actual);
  }
  const filasEstado = ESTADOS_VALIDOS.map((e) => {
    const v = porEstado.get(e) || { cant: 0, unidades: 0 };
    return { estado: nombreEstado(e), cant: v.cant, unidades: v.unidades };
  });

  // El proveedor es opcional, así que puede faltar. Esas requisiciones se
  // cuentan en su propia fila ("Sin proveedor") y no se pierden del reporte.
  const SIN_PROVEEDOR = 0;
  const porProveedor = new Map<number, { nombre: string; ordenes: number; unidades: number; materiales: Set<number> }>();
  for (const o of ordenes) {
    const clave = o.proveedorId ?? SIN_PROVEEDOR;
    const actual = porProveedor.get(clave) || {
      nombre: o.proveedor?.nombre ?? "Sin proveedor",
      ordenes: 0, unidades: 0, materiales: new Set<number>(),
    };
    actual.ordenes += 1;
    actual.unidades += unidadesDeLaOrden(o);
    for (const it of o.items) actual.materiales.add(it.materialId);
    porProveedor.set(clave, actual);
  }
  const filasProveedor = [...porProveedor.values()]
    .map((p) => ({ ...p, materiales: p.materiales.size }))
    .sort((a, b) => (a.nombre === "Sin proveedor" ? 1 : 0) - (b.nombre === "Sin proveedor" ? 1 : 0) || b.unidades - a.unidades);

  const porMaterial = new Map<number, { material: (typeof ordenes)[number]["items"][number]["material"]; cantidad: number; requisiciones: Set<number>; medidas: Set<string> }>();
  for (const o of ordenes) {
    for (const it of o.items) {
      const actual = porMaterial.get(it.materialId) || { material: it.material, cantidad: 0, requisiciones: new Set<number>(), medidas: new Set<string>() };
      actual.cantidad += it.cantidad;
      actual.requisiciones.add(o.id);
      // La unidad es la del renglón, no la del catálogo.
      actual.medidas.add(it.unidad || it.material.unidad);
      porMaterial.set(it.materialId, actual);
    }
  }
  const filasMaterial = [...porMaterial.values()]
    .map((m) => ({ ...m, requisiciones: m.requisiciones.size, unidades: unidadesDe(m.medidas) }))
    .sort((a, b) => b.cantidad - a.cantidad);
  const unidadesCompradas = filasMaterial.reduce((s, m) => s + m.cantidad, 0);

  const porCategoria = new Map<string, { cantidad: number; materiales: Set<number> }>();
  for (const o of ordenes) {
    for (const it of o.items) {
      const cat = it.material.categoria;
      const actual = porCategoria.get(cat) || { cantidad: 0, materiales: new Set<number>() };
      actual.cantidad += it.cantidad;
      actual.materiales.add(it.materialId);
      porCategoria.set(cat, actual);
    }
  }
  const filasCategoria = [...porCategoria.entries()]
    .map(([categoria, v]) => ({ categoria, cantidad: v.cantidad, materiales: v.materiales.size }))
    .sort((a, b) => b.cantidad - a.cantidad);

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
        <div className="ml-auto"><BotonImprimir /></div>
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