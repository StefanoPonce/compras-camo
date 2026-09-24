import Link from "next/link";
import { getServerSession } from "next-auth";
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

export default async function Ordenes({ searchParams }: { searchParams: { estado?: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes")) redirect("/");
  const veTodas = puede(sesion.user.rol, "ordenes.verTodas");
  const uid = Number(sesion!.user.id);
  const filtro = searchParams.estado || "";

  const ordenes = await prisma.ordenCompra.findMany({
    where: {
      ...(veTodas ? {} : { solicitanteId: uid }),
      ...(filtro ? { estado: filtro as "Pendiente" | "Aprobada" | "Rechazada" | "Recibida" } : {}),
    },
    include: { proveedor: true, solicitante: true, items: true },
    orderBy: { fecha: "desc" },
  });

  const filtros = ["", "Pendiente", "Aprobada", "Rechazada", "Recibida"];

  return (
    <>
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-sora font-semibold">Órdenes de compra</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[62ch]">
            {veTodas
              ? "Revisa, aprueba o rechaza las solicitudes. Al marcar una orden como recibida se suma la cantidad al inventario."
              : "Aquí aparecen las órdenes que tú has solicitado y en qué estado van."}
          </p>
        </div>
        <div className="ml-auto"><Link href="/ordenes/nueva" className="btn">Nueva orden</Link></div>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {filtros.map((f) => (
          <Link
            key={f || "todas"}
            href={f ? `/ordenes?estado=${f}` : "/ordenes"}
            className={"btn-chico " + (filtro === f ? "btn" : "btn-secundario")}
          >
            {f ? f + "s" : "Todas"}
          </Link>
        ))}
      </div>

      {ordenes.length ? (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full tabla" style={{ minWidth: 680 }}>
            <thead><tr><th>Folio</th><th>Fecha</th><th>Proveedor</th><th>Solicitante</th><th className="text-right">Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {ordenes.map((o) => (
                <tr key={o.id}>
                  <td className="font-mono">{o.folio}</td>
                  <td>{fecha(o.fecha)}<div className="text-xs text-tinta2">{o.items.length} material(es)</div></td>
                  <td>{o.proveedor.nombre}</td>
                  <td>{o.solicitante.nombre}</td>
                  <td className="text-right">{lps(Number(o.total))}</td>
                  <td><span className={"etiqueta et-" + o.estado.toLowerCase()}>{o.estado}</span></td>
                  <td><Link href={`/ordenes/${o.id}`} className="btn-secundario btn-chico">Ver</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">No hay órdenes con ese filtro.</div>
      )}
    </>
  );
}
