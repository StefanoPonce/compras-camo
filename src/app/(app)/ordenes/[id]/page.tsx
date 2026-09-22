import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BotonesAdmin from "./botones-admin";

function lps(n: number) {
  return "L " + n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fecha(d: Date) {
  return new Date(d).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}
function fechaHora(d: Date) {
  return new Date(d).toLocaleString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function DetalleOrden({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  const esAdmin = sesion!.user.rol === "administrador";

  const o = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id: Number(params.id) },
    include: { proveedor: true, solicitante: true, revisor: true, items: { include: { material: true } } },
  });

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-sora font-semibold">
        Orden <span className="font-mono">{o.folio}</span>
      </h2>
      <p className="text-tinta2 text-sm mt-1 mb-4">
        {o.proveedor.nombre} · {fecha(o.fecha)} · <span className={"etiqueta et-" + o.estado.toLowerCase()}>{o.estado}</span>
      </p>

      <div className="mb-4">
        <Link href={`/ordenes/${o.id}/requisicion`} className="btn-secundario btn-chico">
          Ver requisición para imprimir
        </Link>
      </div>

      {o.justificacion && <p className="mb-4">{o.justificacion}</p>}

      <div className="tarjeta overflow-x-auto mb-3">
        <table className="w-full tabla">
          <thead><tr><th>Material</th><th className="text-right">Cant.</th><th className="text-right">Precio</th><th className="text-right">Subtotal</th></tr></thead>
          <tbody>
            {o.items.map((it) => (
              <tr key={it.id}>
                <td>{it.material.nombre}<div className="text-xs text-tinta2 font-mono">{it.material.codigo}</div></td>
                <td className="text-right">{it.cantidad}</td>
                <td className="text-right">{lps(Number(it.precio))}</td>
                <td className="text-right">{lps(it.cantidad * Number(it.precio))}</td>
              </tr>
            ))}
            <tr><td colSpan={3} className="text-right font-semibold">Total</td><td className="text-right font-semibold">{lps(Number(o.total))}</td></tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-tinta2">
        Solicitó {o.solicitante.nombre}
        {o.revisor && ` · Revisó ${o.revisor.nombre} el ${o.fechaRevision ? fechaHora(o.fechaRevision) : ""}`}
      </p>
      {o.comentario && <p className="bg-superficie2 px-3 py-2.5 rounded-lg text-sm mt-2">{o.comentario}</p>}

      {esAdmin && <BotonesAdmin id={o.id} estado={o.estado} />}
    </div>
  );
}
