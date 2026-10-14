import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo } from "@/lib/permisos";
import BotonesOrden from "./botones-admin";
import BorrarBorrador from "./borrar-borrador";
import ImagenMaterial from "../../imagen-material";
import { textoPrograma } from "@/lib/programas";
import { etiquetaUnidad } from "@/lib/unidades";

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

  const esPropia = o.solicitanteId === Number(sesion!.user.id);
  const esBorrador = o.estado === "Borrador";

  // Quien no ve todas las órdenes solo puede consultar las suyas propias. Un
  // borrador es personal: ni siquiera quien ve todas puede abrir el de otro.
  if (!veTodas && !esPropia) redirect("/ordenes");
  if (esBorrador && !esPropia) redirect("/ordenes");

  // Recibida: nadie la edita. Aprobada: solo administración. Borrador: solo su
  // autor. Las demás: su solicitante o quien puede editar todas.
  const puedeModificar =
    o.estado === "Recibida" ? false
    : esBorrador ? esPropia
    : o.estado === "Aprobada" ? puedeEditarAprobada
    : (puedeEditar || esPropia);

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-sora font-semibold">
        Requisición <span className="font-mono">{o.folio}</span>
      </h2>
      <p className="text-tinta2 text-sm mt-1 mb-4">
        {o.proveedor?.nombre || "Sin proveedor"} · {fecha(o.fecha)} · <span className={"etiqueta et-" + o.estado.toLowerCase()}>{o.estado}</span>
      </p>

      <div className="mb-4 flex gap-2 flex-wrap">
        {!esBorrador && (
          <Link href={`/ordenes/${o.id}/requisicion`} className="btn-secundario btn-chico">
            Ver requisición para imprimir
          </Link>
        )}
        {puedeModificar && (
          <Link href={`/ordenes/${o.id}/editar`} className="btn-secundario btn-chico">
            {esBorrador ? "Continuar editando" : "Editar requisición"}
          </Link>
        )}
        {esBorrador && <BorrarBorrador id={o.id} folio={o.folio} />}
      </div>
      {esBorrador && (
        <p className="text-xs text-tinta2 mb-4">
          Este es un borrador: todavía no se ha enviado. Solo tú lo ves y no entra en revisión hasta que lo envíes.
        </p>
      )}
      {o.estado === "Aprobada" && !puedeModificar && (
        <p className="text-xs text-tinta2 mb-4">Una vez aprobada, solo el administrador o el sub administrador pueden editarla.</p>
      )}
      {o.estado === "Aprobada" && puedeModificar && (
        <p className="text-xs text-tinta2 mb-4">La requisición está aprobada: puedes corregirla y conservará su estado.</p>
      )}
      {o.estado === "Recibida" && (
        <p className="text-xs text-tinta2 mb-4">Requisición recibida: ya no puede editarse.</p>
      )}

      {o.justificacion && <p className="mb-4">{o.justificacion}</p>}

      <div className="tarjeta overflow-x-auto mb-3">
        <table className="w-full tabla">
          <thead><tr><th>Imagen</th><th>Material</th><th>Categoría</th><th>Unidad</th><th className="text-right">Cant.</th><th>Programa</th><th>Proveedor</th><th>Adjunto</th></tr></thead>
          <tbody>
            {o.items.map((it) => (
              <tr key={it.id}>
                <td><ImagenMaterial src={it.material.imagenUrl} alt={it.material.nombre} className="h-12 w-12" /></td>
                <td>{it.material.nombre}<div className="text-xs text-tinta2 font-mono">{it.material.codigo}</div></td>
                <td>{it.material.categoria}</td>
                <td>{etiquetaUnidad(it.unidad || it.material.unidad)}</td>
                <td className="text-right">{it.cantidad}</td>
                <td>{it.programa ? textoPrograma(it.programa) : <span className="text-xs text-tinta2">sin elegir</span>}</td>
                {/* Proveedor del renglón; en órdenes viejas, el de la orden. */}
                <td>{it.proveedor?.nombre || o.proveedor?.nombre || "—"}</td>
                <td>
                  {it.adjuntoUrl ? (
                    <a
                      href={it.adjuntoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-verde underline text-sm"
                    >
                      {it.adjuntoNombre || "Ver archivo"}
                    </a>
                  ) : (
                    <span className="text-xs text-tinta2">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-tinta2">
        Solicitó {o.solicitante.nombre}
        {o.revisor && ` · Revisó ${o.revisor.nombre} el ${o.fechaRevision ? fechaHora(o.fechaRevision) : ""}`}
      </p>
      {o.comentario && <p className="bg-superficie2 px-3 py-2.5 rounded-lg text-sm mt-2">{o.comentario}</p>}

      {(puedeAutorizar || puedeRecibir) && !esBorrador && (
        <BotonesOrden id={o.id} estado={o.estado} puedeAutorizar={puedeAutorizar} puedeRecibir={puedeRecibir} />
      )}
    </div>
  );
}
