import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo } from "@/lib/permisos";
import { textoPrograma } from "@/lib/programas";

function fecha(d: Date) {
  return new Date(d).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}

type EstadoOrden = "Borrador" | "Pendiente" | "Aprobada" | "Rechazada" | "Recibida";

export default async function Ordenes({ searchParams }: { searchParams: { estado?: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes")) redirect("/");
  const veTodas = puede(sesion.user.rol, "ordenes.verTodas");
  const uid = Number(sesion!.user.id);
  const filtro = searchParams.estado || "";

  const ordenes = await prisma.ordenCompra.findMany({
    where: {
      ...(veTodas ? {} : { solicitanteId: uid }),
      // Un borrador es un trabajo a medias personal: aunque el rol vea todas
      // las requisiciones, los borradores ajenos no le aparecen. El filtro de
      // estado los muestra solo si se piden explícitamente y son del usuario.
      OR: [{ estado: { not: "Borrador" } }, { solicitanteId: uid }],
      ...(filtro ? { estado: filtro as EstadoOrden } : {}),
    },
    include: { proveedor: true, solicitante: true, items: true },
    orderBy: { fecha: "desc" },
  });

  const filtros: { valor: EstadoOrden | ""; etiqueta: string }[] = [
    { valor: "", etiqueta: "Todas" },
    { valor: "Borrador", etiqueta: "Borradores" },
    { valor: "Pendiente", etiqueta: "Pendientes" },
    { valor: "Aprobada", etiqueta: "Aprobadas" },
    { valor: "Rechazada", etiqueta: "Rechazadas" },
    { valor: "Recibida", etiqueta: "Recibidas" },
  ];

  // El programa ahora es de cada renglón, así que una requisición puede llevar
  // materiales de varios. Se listan los distintos: el primero con su nombre
  // completo y, si hay más, cuántos sobran.
  const programasDe = (items: { programa: string | null }[]) => {
    const distintos = [...new Set(items.map((it) => it.programa).filter((p): p is string => Boolean(p)))];
    if (distintos.length === 0) return { texto: "-", completo: false };
    const primero = textoPrograma(distintos[0]);
    return {
      texto: distintos.length === 1 ? primero : primero + " +" + (distintos.length - 1) + " más",
      completo: distintos.length === 1,
    };
  };

  return (
    <>
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-sora font-semibold">Requisiciones</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[62ch]">
            {veTodas
              ? "Revisa, aprueba o rechaza las requisiciones. Al marcar una requisición como recibida se suma la cantidad al inventario."
              : "Aquí aparecen las requisiciones que tú has solicitado y en qué estado van."}
          </p>
        </div>
        <div className="ml-auto"><Link href="/ordenes/nueva" className="btn">Nueva requisición</Link></div>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {filtros.map((f) => (
          <Link
            key={f.valor || "todas"}
            href={f.valor ? `/ordenes?estado=${f.valor}` : "/ordenes"}
            className={"btn-chico " + (filtro === f.valor ? "btn" : "btn-secundario")}
          >
            {f.etiqueta}
          </Link>
        ))}
      </div>

      {ordenes.length ? (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full tabla" style={{ minWidth: 680 }}>
            <thead><tr><th>Folio</th><th>Fecha</th><th>Programa</th><th>Proveedor</th><th>Solicitante</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {ordenes.map((o) => {
                const programas = programasDe(o.items);
                return (
                <tr key={o.id}>
                  <td className="font-mono">{o.folio}</td>
                  <td>{fecha(o.fecha)}<div className="text-xs text-tinta2">{o.items.length} material(es)</div></td>
                  <td>
                    {programas.texto}
                    {!programas.completo && programas.texto !== "-" && (
                      <div className="text-xs text-tinta2">varios programas</div>
                    )}
                  </td>
                  {/* Un borrador puede no tener proveedor todavía: se elige al enviar. */}
                  <td>{o.proveedor?.nombre || "—"}</td>
                  <td>{o.solicitante.nombre}</td>
                  <td><span className={"etiqueta et-" + o.estado.toLowerCase()}>{o.estado}</span></td>
                  <td>
                    {o.estado === "Borrador" ? (
                      // En un borrador lo que interesa es retomarlo, no verlo.
                      <Link href={`/ordenes/${o.id}/editar`} className="btn-secundario btn-chico">
                        Continuar editando
                      </Link>
                    ) : (
                      <Link href={`/ordenes/${o.id}`} className="btn-secundario btn-chico">Ver</Link>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">No hay requisiciones con ese filtro.</div>
      )}
    </>
  );
}
