import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo } from "@/lib/permisos";
import BotonesOrden from "./botones-admin";
import BorrarBorrador from "./borrar-borrador";
import MarcarRecibido from "./marcar-recibido";
import ImagenMaterial from "../../imagen-material";
import { textoPrograma } from "@/lib/programas";
import { textoDependencia } from "@/lib/dependencias";
import { etiquetaUnidad } from "@/lib/unidades";
import {
  cantidadesDeRequisicion,
  cantidadesDeRenglon,
  esRequisicionAprobada,
  requisicionTrabajada,
  CLASE_CICLO,
  CLASE_ESTADO,
  ETIQUETAS_CICLO,
  ORDEN_CICLO,
  estadoVisibleDe,
  type CantidadesCiclo,
} from "@/lib/estado-gestion";
import { errorDeAutorizacion, veLaRequisicion } from "@/lib/alcance-area";
import DesgloseCantidades from "../../desglose-cantidades";

function fecha(d: Date) {
  return new Date(d).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}
function fechaHora(d: Date) {
  return new Date(d).toLocaleString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function numero(n: number) {
  return n.toLocaleString("es-HN");
}

/**
 * Estado de compra de un material, como píldoras: una sola si el material
 * está entero en un estado ("En proceso de gestión", "Gestionado",
 * "En proceso de compra" o "Entregado") y varias con su conteo si está a
 * medias (2 CAFÉ MOLIDO con 1 gestionado y 1 por comprar → "Gestionado: 1"
 * y "En proceso de compra: 1"). Es lo que el solicitante y los supervisores
 * leen en la columna Estado.
 */
function PildorasEstado({ reparto }: { reparto: CantidadesCiclo }) {
  const activos = ORDEN_CICLO.filter((estado) => reparto[estado] > 0);
  if (!activos.length) return <span className="text-xs text-tinta2">—</span>;

  return (
    <div className="flex flex-col items-start gap-1">
      {activos.map((estado) => (
        <span key={estado} className={"etiqueta " + CLASE_CICLO[estado]}>
          {activos.length === 1
            ? ETIQUETAS_CICLO[estado]
            : `${ETIQUETAS_CICLO[estado]}: ${numero(reparto[estado])}`}
        </span>
      ))}
    </div>
  );
}

export default async function DetalleOrden({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes")) redirect("/");
  const puedeAutorizarRol = puede(sesion.user.rol, "ordenes.autorizar");
  const puedeRecibir = puede(sesion!.user.rol, "ordenes.recibir");

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

  // Quien no ve todas las órdenes solo puede consultar las suyas propias; un
  // jefe inmediato además solo las de SU gerencia (veLaRequisicion). Un
  // borrador es personal: ni siquiera quien ve todas puede abrir el de otro.
  if (!veLaRequisicion(sesion.user, o)) redirect("/ordenes");
  if (esBorrador && !esPropia) redirect("/ordenes");

  // El jefe inmediato autoriza únicamente las de su área; si no tiene área
  // asignada, no autoriza ninguna (lo dice el motivo). Administración no está
  // limitada por área: es el respaldo de cualquier gerencia.
  const motivoArea = errorDeAutorizacion(sesion.user, o);
  const puedeAutorizar = puedeAutorizarRol && !motivoArea;

  // Quién edita esta requisición: SOLO su solicitante, y solo mientras el
  // estado lo deja (Borrador, Pendiente o Rechazada). Ningún otro rol llega
  // aquí —ni el jefe inmediato, ni la administración—: una aprobada o
  // recibida ya no se corrige desde el sistema.
  const editablePorEstado = o.estado === "Pendiente" || o.estado === "Rechazada";
  const puedeModificar = esPropia && (esBorrador || editablePorEstado);

  // Marcar un producto como recibido lo hace, producto por producto, el
  // solicitante de ESA requisición (y solo cuando ya esté enviada: no se
  // recibe algo pendiente o rechazado). Además el renglón debe estar RESUELTO
  // (Gestionado o ENTREGADO, es decir estadoGestion distinto de "Pendiente"):
  // un producto que todavía ni se gestionó ni se compró no ofrece el botón.
  // Se evalúa por renglón, porque dentro de una misma requisición unos ya
  // están listos y otros todavía no.
  const puedeConfirmarRecibo = esPropia && (o.estado === "Aprobada" || o.estado === "Recibida");

  // Lo que falta por sumar a la existencia: productos ya resueltos
  // (gestionados o comprados) que todavía no se han contado, y los que siguen
  // sin resolver (esos no entran al inventario).
  const porContar = o.items
    .filter((it) => it.estadoGestion !== "Pendiente" && !it.inventariado)
    .map((it) => it.material.nombre);
  const pendientes = o.items.filter((it) => it.estadoGestion === "Pendiente").length;

  // El ciclo de vida de ESTA requisición: en qué estado (sin aprobar · en
  // proceso de gestión · gestionado · en proceso de compra · entregado) está
  // cada unidad de lo pedido. Sale de los renglones de la tabla de abajo, así
  // que es el mismo dato que alimenta la consolidación de Gestión y Compras
  // y las tres pantallas nunca se contradicen. `trabajada` decide si lo que
  // falta sigue en gestión o ya pasó a compra: basta que Gestión registre
  // unidades en un material para que todo lo pendiente de la requisición
  // cambie de estado.
  // ¿La requisición ya fue autorizada? El ciclo de compra solo existe a
  // partir de ahí: mientras esté en Borrador, Pendiente o Rechazada no hay
  // nada que gestionar ni que comprar, y decir "En proceso de gestión" haría
  // creer que Gestión ya la tomó. En esos casos la píldora dice "Sin aprobar".
  const enCiclo = esRequisicionAprobada(o.estado);

  const trabajada = requisicionTrabajada(o.items);
  const cantidades = cantidadesDeRequisicion(o.items, enCiclo);
  const unidades = o.items.reduce((suma, it) => suma + it.cantidad, 0);

  // La píldora del estado de la requisición entera. No es la columna
  // guardada: se calcula con los renglones de abajo, así que una requisición
  // con material resuelto se ve "Pendiente a recibir" y pasa a "Recibido"
  // cuando el solicitante confirma todos sus productos.
  const estadoVisible = estadoVisibleDe(o.estado, o.items);

  return (
    // Ancho amplio: la tabla de renglones tiene 10 columnas y en 672px
    // (max-w-2xl) siempre terminaba desbordando y aparecía la barra de
    // arrastre abajo.
    <div className="max-w-5xl">
      <h2 className="text-xl font-sora font-semibold">
        Requisición <span className="font-mono">{o.folio}</span>
      </h2>
      {/* El área que pide el material, arriba del todo como en el formato. */}
      <p className="text-sm mt-1">
        <span className="text-tinta2">Área de:</span>{" "}
        <strong className="font-medium">{o.area || "—"}</strong>
      </p>
      {/* La gerencia responsable: es el dato con el que se decide quién
          autoriza esta requisición, así que también se muestra arriba. */}
      <p className="text-sm mt-0.5">
        <span className="text-tinta2">Dependencia:</span>{" "}
        <strong className="font-medium">{textoDependencia(o.dependencia) || "—"}</strong>
      </p>
      <p className="text-tinta2 text-sm mt-1 mb-4">
        {o.proveedor?.nombre || "Sin proveedor"} · {fecha(o.fecha)} · <span className={"etiqueta " + CLASE_ESTADO[estadoVisible]}>{estadoVisible}</span>
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
        {/* Para quien solo vino a consultar la requisición: salir sin tener
            que usar el navegador ni bajar hasta el final de la página. */}
        <Link href="/ordenes" className="btn-secundario btn-chico">
          Volver a la lista de requisiciones
        </Link>
      </div>
      {esBorrador && (
        <p className="text-xs text-tinta2 mb-4">
          Este es un borrador: todavía no se ha enviado. Solo tú lo ves y no entra en revisión hasta que lo envíes.
        </p>
      )}
      {/* Un jefe de área que no puede autorizar esta requisición (no es de su
          gerencia, o su cuenta todavía no tiene área) lo ve dicho aquí, en vez
          de encontrar la página sin los botones y sin explicación. */}
      {o.estado === "Pendiente" && puedeAutorizarRol && motivoArea && (
        <p className="text-xs text-rojo mb-4">{motivoArea}</p>
      )}
      {/* La edición es exclusiva del solicitante: a los demás (jefe de área,
          administración, gestión) se les dice quién puede corregirla, en vez
          de encontrar la página sin botones y sin explicación. */}
      {!esPropia && !esBorrador && editablePorEstado && (
        <p className="text-xs text-tinta2 mb-4">
          La puede editar únicamente {o.solicitante.nombre}, que es quien la solicitó.
        </p>
      )}
      {o.estado === "Aprobada" && (
        <p className="text-xs text-tinta2 mb-4">
          Una vez aprobada ya no puede editarse: solo el solicitante la corrige mientras esté pendiente o
          rechazada.
        </p>
      )}
      {o.estado === "Rechazada" && esPropia && (
        <p className="text-xs text-tinta2 mb-4">
          Fue rechazada: puedes corregirla con "Editar requisición" y al guardar volverá a quedar pendiente
          de revisión.
        </p>
      )}
      {/* Aviso de que todavía no hay ciclo de compra: es lo que evita que
          quien consulta crea que Gestión ya está trabajando en ella. */}
      {o.estado === "Pendiente" && (
        <p className="text-xs text-tinta2 mb-4">
          Todavía no se aprueba: mientras siga pendiente no se gestiona ni se compra nada. El estado de
          compra aparece en cuanto el jefe de área la autorice.
        </p>
      )}
      {o.estado === "Recibida" && o.recibidoPorTxt && (
        <p className="text-xs text-tinta2 mb-4">Requisición recibida: ya no puede editarse.</p>
      )}
      {o.estado === "Recibida" && !o.recibidoPorTxt && (
        <p className="text-xs text-tinta2 mb-4">
          Ya no queda ningún material por gestionar en esta requisición. Falta registrar el nombre de quien
          recibió la entrega para sumarlos al inventario.
        </p>
      )}
      {o.estado === "Aprobada" && pendientes > 0 && porContar.length === 0 && (
        <p className="text-xs text-tinta2 mb-4">
          Faltan {pendientes} material(es) por resolver: no entran al inventario hasta que se gestionen o se compren.
        </p>
      )}
      {/* Todo resuelto y todavía sin registrar: antes la requisición se
          cerraba sola en "Recibida" y esta era la indicación que aparecía.
          Ahora se queda Aprobada, así que se dice aquí qué falta para llegar
          a "Recibido". */}
      {o.estado === "Aprobada" && pendientes === 0 && (
        <p className="text-xs text-tinta2 mb-4">
          Ya no queda ningún material por resolver. Falta registrar la entrega para sumarlos al inventario y que
          el solicitante confirme la recepción de cada producto.
        </p>
      )}

      {o.justificacion && <p className="mb-4">{o.justificacion}</p>}

      {/* Lo pedido, desglosado por el ciclo de vida de cada material: en qué
          estado (en proceso de gestión · gestionado · en proceso de compra ·
          entregado) está cada unidad. Sale de los renglones de la tabla de
          abajo, así que siempre suma lo mismo que ellas. Si todavía no se
          aprueba no hay ciclo que desglosar. */}
      <div className="flex items-baseline gap-1.5 flex-wrap text-xs mb-3">
        <span className="text-tinta2">Unidades solicitadas:</span>
        <strong className="font-sora text-sm">{numero(unidades)}</strong>
        {enCiclo ? (
          <DesgloseCantidades cantidades={cantidades} />
        ) : (
          <>
            <span className={"etiqueta " + CLASE_CICLO.SinAprobar}>{ETIQUETAS_CICLO.SinAprobar}</span>
            <span className="text-tinta2">
              · el ciclo de compra empieza cuando se autorice.
            </span>
          </>
        )}
      </div>

      {/* Ancho mínimo con holgura: las columnas de texto largo (categoría,
          programa, proveedor) se acotan a dos líneas en vez de estirar la
          tabla, así en una pantalla normal no aparece la barra de arrastre.
          El texto completo se ve al pasar el mouse (title). */}
      <div className="tarjeta overflow-x-auto mb-3">
        <table className="w-full tabla" style={{ minWidth: 940 }}>
          <thead><tr><th>Imagen</th><th>Material</th><th>Categoría</th><th>Unidad</th><th className="text-right">Cant.</th><th>Programa</th><th>Proveedor</th><th>Adjunto</th><th>Estado</th><th className="no-imprimir col-acciones">Recibido</th></tr></thead>
          <tbody>
            {o.items.map((it) => (
              <tr key={it.id}>
                <td><ImagenMaterial src={it.material.imagenUrl} alt={it.material.nombre} className="h-10 w-10" /></td>
                {/* overflow-wrap:anywhere: un nombre o un archivo muy largo
                    se parte dentro de su celda en vez de estirar la tabla y
                    provocar la barra de arrastre abajo. */}
                <td className="[overflow-wrap:anywhere]">{it.material.nombre}<div className="text-xs text-tinta2 font-mono">{it.material.codigo}</div></td>
                {/* Categorías largas (ej. "SUMINISTROS PARA ATENCION A
                    PERSONAS…") son las que más alto ponían la fila: se ven
                    dos líneas y el resto queda en el tooltip. El clamp va en
                    un div, porque aplicado al td cambiaría su display y
                    descuadraría las columnas. */}
                <td className="max-w-[15rem]">
                  <div className="line-clamp-2" title={it.material.categoria}>{it.material.categoria}</div>
                </td>
                <td className="whitespace-nowrap">{etiquetaUnidad(it.unidad || it.material.unidad)}</td>
                <td className="text-right whitespace-nowrap">{it.cantidad}</td>
                <td className="max-w-[11rem]">
                  <div className="line-clamp-2" title={it.programa ? textoPrograma(it.programa) : undefined}>
                    {it.programa ? textoPrograma(it.programa) : <span className="text-xs text-tinta2">sin elegir</span>}
                  </div>
                </td>
                {/* Proveedor del renglón; en órdenes viejas, el de la orden. */}
                <td className="max-w-[8rem]">
                  <div className="line-clamp-2" title={it.proveedor?.nombre || o.proveedor?.nombre || undefined}>
                    {it.proveedor?.nombre || o.proveedor?.nombre || "—"}
                  </div>
                </td>
                <td className="[overflow-wrap:anywhere]">
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
                {/* Estado de compra del renglón: lo marcan Gestión y Compras.
                    Se ve el ciclo completo del material, con cuántas unidades
                    va en cada paso; mientras no se apruebe no hay ciclo y la
                    píldora dice "Sin aprobar". */}
                <td>
                  {enCiclo ? (
                    <PildorasEstado reparto={cantidadesDeRenglon(it, trabajada)} />
                  ) : (
                    <span className={"etiqueta " + CLASE_CICLO.SinAprobar}>
                      {ETIQUETAS_CICLO.SinAprobar}
                    </span>
                  )}
                </td>
                {/* El solicitante confirma, renglón por renglón, que ya le
                    llegó el material. Solo él puede poner esta marca, y solo
                    cuando el producto ya esté gestionado o comprado: si sigue
                    Pendiente ni siquiera se ofrece el botón. Va pegada al
                    borde derecho (col-acciones) para que se alcance a ver sin
                    arrastrar la tabla. */}
                <td className="no-imprimir col-acciones">
                  <MarcarRecibido
                    lineaId={it.id}
                    material={it.material.nombre}
                    confirmado={it.recibidoSolicitante}
                    fecha={it.recibidoSolicitanteEn ? fecha(it.recibidoSolicitanteEn) : null}
                    puedeMarcar={puedeConfirmarRecibo && (it.estadoGestion !== "Pendiente" || it.recibidoSolicitante)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-tinta2">
        Solicitó {o.solicitante.nombre}
        {o.revisor && (o.estado === "Rechazada"
          ? ` · Rechazó ${o.revisor.nombre} el ${o.fechaRevision ? fechaHora(o.fechaRevision) : ""}`
          : ` · Revisó ${o.revisor.nombre} el ${o.fechaRevision ? fechaHora(o.fechaRevision) : ""}`)}
        {o.recibidoPorTxt &&
          ` · Recibió ${o.recibidoPorTxt}${o.fechaRecepcion ? ` el ${fechaHora(o.fechaRecepcion)}` : ""}`}
      </p>
      {o.comentario && <p className="bg-superficie2 px-3 py-2.5 rounded-lg text-sm mt-2">{o.comentario}</p>}

      {(puedeAutorizar || puedeRecibir) && !esBorrador && (
        <BotonesOrden
          id={o.id}
          folio={o.folio}
          estado={o.estado}
          puedeAutorizar={puedeAutorizar}
          puedeRecibir={puedeRecibir}
          porContar={porContar}
          pendientes={pendientes}
        />
      )}
    </div>
  );
}
