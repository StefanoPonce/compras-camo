import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function lps(n: number) {
  return "L " + n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fecha(d: Date) {
  return new Date(d).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}

function Indicador({ n, t, alerta }: { n: string | number; t: string; alerta?: boolean }) {
  return (
    <div className="tarjeta p-4">
      <div className={"font-sora text-2xl font-semibold " + (alerta ? "text-rojo" : "")}>{n}</div>
      <div className="text-sm text-tinta2 mt-1">{t}</div>
    </div>
  );
}

export default async function Panel() {
  const sesion = await getServerSession(authOptions);
  const esAdmin = sesion!.user.rol === "administrador";
  const uid = Number(sesion!.user.id);

  const [pendientes, proveedoresActivos, totalMateriales, bajos, ordenesRecientes] = await Promise.all([
    prisma.ordenCompra.count({ where: { estado: "Pendiente" } }),
    prisma.proveedor.count({ where: { activo: true } }),
    prisma.material.count(),
    prisma.material.findMany({
      where: { activo: true },
      include: { proveedor: true },
    }).then((ms) => ms.filter((m) => m.existencia <= m.minimo)),
    prisma.ordenCompra.findMany({
      where: esAdmin ? {} : { solicitanteId: uid },
      include: { proveedor: true, solicitante: true },
      orderBy: { fecha: "desc" },
      take: 5,
    }),
  ]);

  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const gastoMes = await prisma.ordenCompra.aggregate({
    _sum: { total: true },
    where: { estado: { in: ["Aprobada", "Recibida"] }, fecha: { gte: inicioMes } },
  });

  return (
    <>
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-sora font-semibold">
            Hola, {(sesion!.user.name || "").split(" ")[0]}
          </h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[60ch]">
            {esAdmin
              ? `Tienes ${pendientes} orden(es) esperando tu revisión.`
              : "Desde aquí solicitas materiales y sigues el estado de tus órdenes."}
          </p>
        </div>
        <div className="ml-auto">
          <Link href="/ordenes/nueva" className="btn">Nueva orden de compra</Link>
        </div>
      </div>

      <div
  className="grid gap-3.5 mb-6"
  style={{
    gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))",
  }}
>
  {/* Solo el administrador puede ver estas dos cards */}
  {esAdmin && (
    <>
      <Indicador
        n={pendientes}
        t="Órdenes pendientes de aprobar"
        alerta={pendientes > 0}
      />

      <Indicador
        n={lps(Number(gastoMes._sum.total || 0))}
        t="Comprado este mes"
      />
    </>
  )}

  {/* Estas cards las pueden ver ambos roles */}
  <Indicador
    n={proveedoresActivos}
    t="Proveedores activos"
  />

  <Indicador
    n={totalMateriales}
    t="Materiales registrados"
  />

  <Indicador
    n={bajos.length}
    t="Materiales bajo el mínimo"
    alerta={bajos.length > 0}
  />
</div>

      {bajos.length > 0 && (
        <>
          <h3 className="text-base font-sora font-semibold mb-2.5">Hay que reponer</h3>
          <div className="tarjeta overflow-x-auto mb-6">
            <table className="w-full tabla" style={{ minWidth: 560 }}>
              <thead><tr><th>Código</th><th>Material</th><th className="text-right">Existencia</th><th className="text-right">Mínimo</th><th>Proveedor habitual</th></tr></thead>
              <tbody>
                {bajos.map((m) => (
                  <tr key={m.id}>
                    <td className="font-mono">{m.codigo}</td>
                    <td>{m.nombre}</td>
                    <td className="text-right text-rojo font-semibold">{m.existencia}</td>
                    <td className="text-right">{m.minimo}</td>
                    <td>{m.proveedor?.nombre || "Sin proveedor"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="text-base font-sora font-semibold mb-2.5">{esAdmin ? "Últimas órdenes" : "Mis últimas órdenes"}</h3>
      {ordenesRecientes.length ? (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full tabla" style={{ minWidth: 620 }}>
            <thead><tr><th>Folio</th><th>Fecha</th><th>Proveedor</th><th>Solicitante</th><th className="text-right">Total</th><th>Estado</th></tr></thead>
            <tbody>
              {ordenesRecientes.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono"><Link className="text-verde" href={`/ordenes/${o.id}`}>{o.folio}</Link></td>
                  <td>{fecha(o.fecha)}</td>
                  <td>{o.proveedor.nombre}</td>
                  <td>{o.solicitante.nombre}</td>
                  <td className="text-right">{lps(Number(o.total))}</td>
                  <td><span className={"etiqueta et-" + o.estado.toLowerCase()}>{o.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">Todavía no hay órdenes. Crea la primera con el botón de arriba.</div>
      )}
    </>
  );
}
