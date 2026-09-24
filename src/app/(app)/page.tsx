import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo } from "@/lib/permisos";

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
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "panel")) redirect("/");
  const veOrdenes = puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes");
  const veProveedores = puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "proveedores");
  const veMateriales = puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "materiales");
  const veTodas = veOrdenes && puede(sesion.user.rol, "ordenes.verTodas");
  const vePendientes = veOrdenes && puede(sesion.user.rol, "ordenes.autorizar");
  const veGastos = puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "reportes") && puede(sesion.user.rol, "reportes.ver");
  const uid = Number(sesion.user.id);

  const [pendientes, proveedoresActivos, totalMateriales, bajos, ordenesRecientes] = await Promise.all([
    prisma.ordenCompra.count({ where: { estado: "Pendiente" } }),
    prisma.proveedor.count({ where: { activo: true } }),
    prisma.material.count(),
    prisma.material.findMany({
      where: { activo: true },
      include: { proveedor: true },
    }).then((ms) => ms.filter((m) => m.existencia <= m.minimo)),
    prisma.ordenCompra.findMany({
      where: veTodas ? {} : { solicitanteId: uid },
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
            {vePendientes
              ? `Tienes ${pendientes} requisición(es) esperando tu revisión.`
              : veOrdenes
                ? "Desde aquí solicitas productos y sigues el estado de tus requisiciones."
                : "Consulta los módulos disponibles desde el menú."}
          </p>
        </div>
        {veOrdenes && puede(sesion.user.rol, "ordenes.crear") && (
          <div className="ml-auto">
            <Link href="/ordenes/nueva" className="btn">Nueva requisición</Link>
          </div>
        )}
      </div>

      <div
  className="grid gap-3.5 mb-6"
  style={{
    gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))",
  }}
>
  {/* Quien autoriza ve las requisiciones pendientes; quien genera reportes ve el gasto */}
  {(vePendientes || veGastos) && (
    <>
      {vePendientes && (
        <Indicador
          n={pendientes}
          t="Requisiciones pendientes de aprobar"
          alerta={pendientes > 0}
        />
      )}

      {veGastos && (
        <Indicador
          n={lps(Number(gastoMes._sum.total || 0))}
          t="Comprado este mes"
        />
      )}
    </>
  )}

  {veProveedores && (
    <Indicador
      n={proveedoresActivos}
      t="Proveedores activos"
    />
  )}

  {veMateriales && (
    <Indicador
      n={totalMateriales}
      t="Materiales registrados"
    />
  )}

  {veMateriales && (
    <Indicador
      n={bajos.length}
      t="Materiales bajo el mínimo"
      alerta={bajos.length > 0}
    />
  )}
</div>

      {veMateriales && bajos.length > 0 && (
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

      {veOrdenes && (
        <>
          <h3 className="text-base font-sora font-semibold mb-2.5">{veTodas ? "Últimas requisiciones" : "Mis últimas requisiciones"}</h3>
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
            <div className="tarjeta p-10 text-center text-tinta2">Todavía no hay requisiciones. Crea la primera con el botón de arriba.</div>
          )}
        </>
      )}
    </>
  );
}
