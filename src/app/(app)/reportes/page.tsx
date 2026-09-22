import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BotonImprimir from "./boton-imprimir";
import Image from "next/image";


function lps(n: number) {
  return "L " + n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
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

export default async function Reportes({
  searchParams,
}: { searchParams: { desde?: string; hasta?: string; estado?: string } }) {
  const sesion = await getServerSession(authOptions);
  if (sesion?.user.rol !== "administrador") redirect("/");

  const desde = searchParams.desde || primerDiaDelMes();
  const hasta = searchParams.hasta || hoy();
  const estadoParam = searchParams.estado || "AR";

  let estados: string[] | undefined;
  if (estadoParam === "todas") estados = undefined;
  else if (estadoParam === "AR") estados = ["Aprobada", "Recibida"];
  else if ((ESTADOS_VALIDOS as readonly string[]).includes(estadoParam)) estados = [estadoParam];
  else estados = ["Aprobada", "Recibida"];

  const ordenes = await prisma.ordenCompra.findMany({
    where: {
      fecha: { gte: new Date(desde + "T00:00:00"), lte: new Date(hasta + "T23:59:59") },
      ...(estados ? { estado: { in: estados as ("Pendiente" | "Aprobada" | "Rechazada" | "Recibida")[] } } : {}),
    },
    include: { proveedor: true, items: { include: { material: true } } },
    orderBy: { fecha: "asc" },
  });

  const totalGeneral = ordenes.reduce((s, o) => s + Number(o.total), 0);

  const porProveedor = new Map<number, { nombre: string; ordenes: number; total: number }>();
  for (const o of ordenes) {
    const actual = porProveedor.get(o.proveedorId) || { nombre: o.proveedor.nombre, ordenes: 0, total: 0 };
    actual.ordenes += 1;
    actual.total += Number(o.total);
    porProveedor.set(o.proveedorId, actual);
  }
  const filasProveedor = [...porProveedor.values()].sort((a, b) => b.total - a.total);

  const porCategoria = new Map<string, { cantidad: number; total: number }>();
  for (const o of ordenes) {
    for (const it of o.items) {
      const cat = it.material.categoria;
      const actual = porCategoria.get(cat) || { cantidad: 0, total: 0 };
      actual.cantidad += it.cantidad;
      actual.total += it.cantidad * Number(it.precio);
      porCategoria.set(cat, actual);
    }
  }
  const filasCategoria = [...porCategoria.entries()]
    .map(([categoria, v]) => ({ categoria, ...v }))
    .sort((a, b) => b.total - a.total);

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
        <div className="text-tinta2 text-sm">Reporte de gasto por período y proveedor</div>
        <div className="text-tinta2 text-xs mt-1">
          Del {fecha(desde)} al {fecha(hasta)} · Generado el {generado} por {sesion.user.name}
        </div>
        <hr className="my-3 border-borde" />
      </div>

      <div className="flex items-start gap-3 flex-wrap mb-4 no-imprimir">
        <div>
          <h2 className="text-xl font-sora font-semibold">Reportes</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[62ch]">
            Gasto agrupado por proveedor y por categoría de material, para el período que elijas.
          </p>
        </div>
        <div className="ml-auto"><BotonImprimir /></div>
      </div>

      <form className="flex gap-2 flex-wrap items-end mb-6 no-imprimir" action="/reportes">
        <div>
          <label className="block text-xs text-tinta2 mb-1">Desde</label>
          <input className="campo-input" type="date" name="desde" defaultValue={desde} />
        </div>
        <div>
          <label className="block text-xs text-tinta2 mb-1">Hasta</label>
          <input className="campo-input" type="date" name="hasta" defaultValue={hasta} />
        </div>
        <div>
          <label className="block text-xs text-tinta2 mb-1">Órdenes a incluir</label>
          <select className="campo-input" name="estado" defaultValue={estadoParam}>
            <option value="AR">Aprobadas y recibidas</option>
            <option value="todas">Todas (incluye pendientes y rechazadas)</option>
            <option value="Pendiente">Solo pendientes</option>
            <option value="Aprobada">Solo aprobadas</option>
            <option value="Rechazada">Solo rechazadas</option>
            <option value="Recibida">Solo recibidas</option>
          </select>
        </div>
        <button className="btn-secundario">Aplicar</button>
      </form>

      <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))" }}>
        <div className="tarjeta p-4">
          <div className="font-sora text-2xl font-semibold">{lps(totalGeneral)}</div>
          <div className="text-sm text-tinta2 mt-1">Total del período</div>
        </div>
        <div className="tarjeta p-4">
          <div className="font-sora text-2xl font-semibold">{ordenes.length}</div>
          <div className="text-sm text-tinta2 mt-1">Órdenes incluidas</div>
        </div>
        <div className="tarjeta p-4">
          <div className="font-sora text-2xl font-semibold">{filasProveedor.length}</div>
          <div className="text-sm text-tinta2 mt-1">Proveedores distintos</div>
        </div>
      </div>

      <h3 className="text-base font-sora font-semibold mb-2.5">Por proveedor</h3>
      {filasProveedor.length ? (
        <div className="tarjeta overflow-x-auto mb-6">
          <table className="w-full tabla" style={{ minWidth: 480 }}>
            <thead><tr><th>Proveedor</th><th className="text-right">Órdenes</th><th className="text-right">Total</th><th className="text-right">% del total</th></tr></thead>
            <tbody>
              {filasProveedor.map((p) => (
                <tr key={p.nombre}>
                  <td>{p.nombre}</td>
                  <td className="text-right">{p.ordenes}</td>
                  <td className="text-right">{lps(p.total)}</td>
                  <td className="text-right">{totalGeneral ? ((p.total / totalGeneral) * 100).toFixed(1) : "0.0"}%</td>
                </tr>
              ))}
              <tr><td className="font-semibold">Total</td><td className="text-right font-semibold">{ordenes.length}</td><td className="text-right font-semibold">{lps(totalGeneral)}</td><td></td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2 mb-6">No hay compras en ese período con ese filtro.</div>
      )}

      <h3 className="text-base font-sora font-semibold mb-2.5">Por categoría de material</h3>
      {filasCategoria.length ? (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full tabla" style={{ minWidth: 480 }}>
            <thead><tr><th>Categoría</th><th className="text-right">Unidades compradas</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {filasCategoria.map((c) => (
                <tr key={c.categoria}>
                  <td>{c.categoria}</td>
                  <td className="text-right">{c.cantidad}</td>
                  <td className="text-right">{lps(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">No hay materiales comprados en ese período.</div>
      )}
    </>
  );
}
