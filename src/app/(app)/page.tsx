import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo, inventarioPropio } from "@/lib/permisos";
import { materialesSolicitadosPor, filtroMaterialesPropios } from "@/lib/materiales-solicitados";
import { textoDependencia } from "@/lib/dependencias";
import { alcanceRequisiciones, areaDe, veTodasLasAreas } from "@/lib/alcance-area";
import { CLASE_ESTADO, estadoVisibleDe } from "@/lib/estado-gestion";

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
  const veReportes = puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "reportes") && puede(sesion.user.rol, "reportes.ver");
  const uid = Number(sesion.user.id);
  // Para el responsable de solicitar todas las filas son suyas: la columna
  // "Solicitante" solo repite su nombre, así que se oculta en ese rol.
  const muestraSolicitante = sesion.user.rol !== "responsable_solicitante";

  // Qué le toca ver a ESTE usuario en el panel: todas las áreas
  // (administración y gestión), las de su gerencia o solo las suyas.
  const alcance = alcanceRequisiciones({ id: uid, rol: sesion.user.rol, area: sesion.user.area });
  const areaPropia = areaDe(sesion.user);
  const veSoloSuArea = veTodas && !veTodasLasAreas(sesion.user.rol) && areaPropia !== "";

  // El responsable de solicitar solo ve SU inventario: los materiales de las
  // requisiciones que él envió. Los demás roles ven el catálogo completo.
  const soloPropio = inventarioPropio(sesion.user.rol);
  const propios = soloPropio ? await materialesSolicitadosPor(uid) : null;
  const filtroPropios = filtroMaterialesPropios(propios);

  const [pendientes, proveedoresActivos, totalMateriales, bajos, ordenesRecientes] = await Promise.all([
    // Pendientes de aprobar: para un jefe inmediato cuentan solo las de su
    // gerencia, que son las que realmente puede autorizar.
    prisma.ordenCompra.count({ where: { estado: "Pendiente", ...alcance } }),
    prisma.proveedor.count({ where: { activo: true } }),
    prisma.material.count({ where: filtroPropios }),
    prisma.material.findMany({
      where: { activo: true, ...filtroPropios },
      include: { proveedor: true },
    }).then((ms) => ms.filter((m) => m.existencia <= m.minimo)),
    prisma.ordenCompra.findMany({
      where: {
        ...alcance,
        // El panel resume lo que está en juego. Un borrador no cuenta: es un
        // trabajo a medias personal y se sigue en /ordenes.
        estado: { not: "Borrador" },
      },
      // La píldora del estado se calcula con los renglones (Pendiente a
      // recibir / Recibido), así que hace falta traerlos.
      include: { proveedor: true, solicitante: true, items: { select: { estadoGestion: true, recibidoSolicitante: true } } },
      orderBy: { fecha: "desc" },
      take: 5,
    }),
  ]);

  // Sin importes: se cuenta cuántas requisiciones se gestionaron este mes.
  const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const gestionadasMes = await prisma.ordenCompra.count({
    where: { estado: { in: ["Aprobada", "Recibida"] }, fecha: { gte: inicioMes } },
  });

  return (
    <>
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-sora font-semibold">
            Hola, {(sesion!.user.name || "").split(" ")[0]}
            {/* La gerencia de la cuenta: el usuario siempre ve de qué área es. */}
            {areaPropia && (
              <span className="text-tinta2 font-normal text-base"> · {textoDependencia(areaPropia)}</span>
            )}
          </h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[60ch]">
            {vePendientes
              ? veSoloSuArea
                ? `Tienes ${pendientes} requisición(es) de ${textoDependencia(areaPropia)} esperando tu revisión.`
                : `Tienes ${pendientes} requisición(es) esperando tu revisión.`
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
  {/* Quien autoriza ve las requisiciones pendientes; quien genera reportes ve el movimiento del mes */}
  {(vePendientes || veReportes) && (
    <>
      {vePendientes && (
        <Indicador
          n={pendientes}
          t="Requisiciones pendientes de aprobar"
          alerta={pendientes > 0}
        />
      )}

      {veReportes && (
        <Indicador
          n={gestionadasMes}
          t="Requisiciones gestionadas este mes"
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
      t={soloPropio ? "Materiales en tus requisiciones" : "Materiales registrados"}
    />
  )}

  {veMateriales && (
    <Indicador
      n={bajos.length}
      t={soloPropio ? "De tus materiales, bajo el mínimo" : "Materiales bajo el mínimo"}
      alerta={bajos.length > 0}
    />
  )}
</div>

      {soloPropio && veMateriales && (
        <p className="text-xs text-tinta2 -mt-3 mb-5">
          Solo se muestran los materiales de las requisiciones que tú enviaste (pendientes o ya recibidas).
        </p>
      )}

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
          <h3 className="text-base font-sora font-semibold mb-2.5">
            {veSoloSuArea
              ? "Últimas requisiciones de tu área"
              : veTodas
                ? "Últimas requisiciones"
                : "Mis últimas requisiciones"}
          </h3>
          {ordenesRecientes.length ? (
            <div className="tarjeta overflow-x-auto">
              <table className="w-full tabla" style={{ minWidth: 620 }}>
                <thead><tr><th>Folio</th><th>Fecha</th><th>Proveedor</th>{muestraSolicitante && <th>Solicitante</th>}<th>Estado</th></tr></thead>
                <tbody>
                  {ordenesRecientes.map((o) => {
                    const estadoVisible = estadoVisibleDe(o.estado, o.items);
                    return (
                    <tr key={o.id}>
                      <td className="font-mono"><Link className="text-verde" href={`/ordenes/${o.id}`}>{o.folio}</Link></td>
                      <td>{fecha(o.fecha)}</td>
                      <td>{o.proveedor?.nombre || "—"}</td>
                      {muestraSolicitante && <td>{o.solicitante.nombre}</td>}
                      <td><span className={"etiqueta " + CLASE_ESTADO[estadoVisible]}>{estadoVisible}</span></td>
                    </tr>
                    );
                  })}
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
