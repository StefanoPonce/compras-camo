import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo } from "@/lib/permisos";
import BotonesOrden from "./botones-admin";
import ImagenMaterial from "../../imagen-material";

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
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes")) redirect("/");
  const veTodas = puede(sesion.user.rol, "ordenes.verTodas");
  const puedeAutorizar = puede(sesion!.user.rol, "ordenes.autorizar");
  const puedeRecibir = puede(sesion!.user.rol, "ordenes.recibir");
  const puedeEditar = puede(sesion!.user.rol, "ordenes.editarTodas");
  const puedeEditarAprobada = puede(sesion!.user.rol, "ordenes.editarAprobadas");

  const o = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id: Number(params.id) },
    include: {
      proveedor: true,
      solicitante: true,
      revisor: true,
      items: { include: { material: true, proveedor: true } },
    },
  });

  // Quien no ve todas las órdenes solo puede consultar las suyas propias.
  if (!veTodas && o.solicitanteId !== Number(sesion!.user.id)) {
    redirect("/ordenes");
  }

  const esPropia = o.solicitanteId === Number(sesion!.user.id);
  // Recibida: nadie la edita. Aprobada: solo administración. Las demás: su
  // solicitante o quien puede editar todas.
  const puedeModificar =
    o.estado === "Recibida" ? false
    : o.estado === "Aprobada" ? puedeEditarAprobada
    : (puedeEditar || esPropia);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-sora font-semibold">
        Orden <span className="font-mono">{o.folio}</span>
      </h2>
      <p className="text-tinta2 text-sm mt-1 mb-4">
        {o.proveedor.nombre} · {fecha(o.fecha)} · <span className={"etiqueta et-" + o.estado.toLowerCase()}>{o.estado}</span>
      </p>

      <div className="mb-4 flex gap-2 flex-wrap">
        <Link href={`/ordenes/${o.id}/requisicion`} className="btn-secundario btn-chico">
          Ver requisición para imprimir
        </Link>
        {puedeModificar && (
          <Link href={`/ordenes/${o.id}/editar`} className="btn-secundario btn-chico">
            Editar orden
          </Link>
        )}
      </div>
      {o.estado === "Aprobada" && !puedeModificar && (
        <p className="text-xs text-tinta2 mb-4">Una vez aprobada, solo el administrador o el sub administrador pueden editarla.</p>
      )}
      {o.estado === "Aprobada" && puedeModificar && (
        <p className="text-xs text-tinta2 mb-4">La orden está aprobada: puedes corregirla y conservará su estado.</p>
      )}
      {o.estado === "Recibida" && (
        <p className="text-xs text-tinta2 mb-4">Orden recibida: ya no puede editarse.</p>
      )}

      {o.justificacion && <p className="mb-4">{o.justificacion}</p>}

      <div className="tarjeta overflow-x-auto mb-3">
        <table className="w-full tabla">
          <thead><tr><th>Imagen</th><th>Material</th><th>Unidad</th><th>Proveedor</th><th className="text-right">Cant.</th><th className="text-right">Precio</th></tr></thead>
          <tbody>
            {o.items.map((it) => (
              <tr key={it.id}>
                <td><ImagenMaterial src={it.material.imagenUrl} alt={it.material.nombre} className="h-12 w-12" /></td>
                <td>{it.material.nombre}<div className="text-xs text-tinta2 font-mono">{it.material.codigo}</div></td>
                <td>{it.material.unidad}</td>
                {/* Proveedor del renglón; en órdenes viejas, el de la orden. */}
                <td>{it.proveedor?.nombre || o.proveedor.nombre}</td>
                <td className="text-right">{it.cantidad}</td>
                <td className="text-right">{lps(Number(it.precio))}</td>
              </tr>
            ))}
            <tr><td colSpan={5} className="text-right font-semibold">Total</td><td className="text-right font-semibold">{lps(Number(o.total))}</td></tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-tinta2">
        Solicitó {o.solicitante.nombre}
        {o.revisor && ` · Revisó ${o.revisor.nombre} el ${o.fechaRevision ? fechaHora(o.fechaRevision) : ""}`}
      </p>
      {o.comentario && <p className="bg-superficie2 px-3 py-2.5 rounded-lg text-sm mt-2">{o.comentario}</p>}

      {(puedeAutorizar || puedeRecibir) && (
        <BotonesOrden id={o.id} estado={o.estado} puedeAutorizar={puedeAutorizar} puedeRecibir={puedeRecibir} />
      )}
    </div>
  );
}
