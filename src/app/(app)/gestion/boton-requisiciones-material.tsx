"use client";
// Botón de cada renglón de la consolidación de Gestión: abre una ventana con
// la lista de requisiciones donde se está solicitando ese material (folio,
// fecha, solicitante, cantidad pedida y estado), sin salir de la página.
//
// La lista es exactamente la que indica la columna "Origen" de la fila: las
// requisiciones de ese grupo de proveedor que traen el material, de modo que
// lo que se ve en la ventana coincide con lo que se imprime en el consolidado.
//
// Además de mirar, la ventana sirve para DECIDIR A QUIÉN se le gestionó (o se
// le compró). Es el ÚNICO lugar donde se registra: la tabla ya no lleva
// columna de conteo, porque un campo por fila repartía las unidades solo —del
// renglón más viejo al más reciente— y no dejaba elegir. Acá cada solicitante
// lleva SU propio campo, que escribe únicamente el renglón de SU requisición.
// El encargado pone 1 en Erick y 0 en Luis, y el de Luis se queda sin
// resolver: no se le pudo gestionar.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { actualizarConteoRenglon } from "../actions";
import { CLASE_ESTADO, type EstadoVisible } from "@/lib/estado-gestion";

export type RequisicionDelMaterial = {
  id: number;
  folio: string;
  /** Fecha ya formateada en el servidor (es-HN). */
  fecha: string;
  /** Estado calculado de la requisición entera (ver estadoVisibleDe). */
  estado: EstadoVisible;
  solicitante: string;
  /** Lo que pide esta requisición de este material (no la suma consolidada). */
  cantidad: number;
  unidad: string;
  /** Renglón (detalle_orden) de ESTA requisición para este material: es el
   *  único que toca el campo de esta fila de la ventana. */
  lineaId: number;
  /** Unidades que ese renglón ya trae en cada contador. De ahí sale lo que
   *  muestra el campo y hasta cuánto acepta. */
  gestionadas: number;
  compradas: number;
  /** Motivo por el que el renglón no admite cambios (null si lo admite):
   *  requisición aún no aprobada o material ya en inventario. */
  bloqueo: string | null;
};

type Props = {
  material: { nombre: string; codigo: string };
  requisiciones: RequisicionDelMaterial[];
  /** Qué contador escribe este módulo: el de gestión o el de compras. */
  campo: "gestionada" | "comprada";
  /** Nombre del contador ("Cantidad gestionada" o "Cantidad comprada"): es el
   *  encabezado del campo de cada solicitante en la ventana y el texto de los
   *  mensajes, que es donde queda dicho hasta cuánto se puede poner. */
  titulo: string;
};

function numero(n: number) {
  return n.toLocaleString("es-HN");
}

/** Desenfoca lo que esté activo para que un campo con valor tecleado mande su
 *  onBlur (que es donde se guarda) antes de que la ventana se desmonte. */
function desenfocarCampo() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

export default function BotonRequisicionesMaterial({ material, requisiciones, campo, titulo }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [ocupando, setOcupando] = useState<number | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!abierto) return;

    const elementoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowAnterior = document.body.style.overflow;
    const alPresionarTecla = (evento: KeyboardEvent) => {
      // Si el foco está en un campo con un valor tecleado sin guardar, se
      // desenfoca ANTES de cerrar: el onBlur es el que manda el valor, y si la
      // ventana se desmonta primero ese número se perdería.
      if (evento.key === "Escape") {
        desenfocarCampo();
        setAbierto(false);
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", alPresionarTecla);
    const enfocar = window.requestAnimationFrame(() => botonCerrar.current?.focus());

    return () => {
      window.cancelAnimationFrame(enfocar);
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", alPresionarTecla);
      elementoAnterior?.focus();
    };
  }, [abierto]);

  // Lo que el contador de este módulo ya registra en el renglón de ese
  // solicitante, y lo máximo que puede llevar: la cantidad pedida menos lo que
  // ya resolvió EL OTRO contador (lo gestionado no se puede comprar y viceversa).
  const registradasDe = (req: RequisicionDelMaterial) =>
    campo === "comprada" ? req.compradas : req.gestionadas;
  const topeDe = (req: RequisicionDelMaterial) =>
    campo === "comprada" ? req.cantidad - req.gestionadas : req.cantidad - req.compradas;

  /** Guarda lo que el encargado puso en el campo de UN solicitante. Va al
   *  salir del campo o al pulsar Enter, para no mandar un valor a medias
   *  mientras escribe. */
  async function aplicar(req: RequisicionDelMaterial, texto: string) {
    const valor = Math.round(Number(texto));
    const registradas = registradasDe(req);
    // Solo se evita reentrar en el MISMO renglón: guardar otro solicitante en
    // paralelo no pisa nada, porque cada campo escribe su propio renglón.
    if (req.bloqueo || ocupando === req.lineaId || !Number.isFinite(valor) || valor === registradas) return;

    setOcupando(req.lineaId);
    try {
      const resultado = await actualizarConteoRenglon(campo, req.lineaId, valor);
      if (resultado?.error) {
        alert(resultado.error);
        return;
      }
      // El servidor recorta al tope del renglón; si dio menos de lo pedido se
      // avisa en vez de dejar el campo diciendo algo que no quedó guardado.
      if (typeof resultado?.aplicadas === "number" && resultado.aplicadas < valor) {
        alert(
          `Solo se pudieron registrar ${resultado.aplicadas} de ${valor} unidad(es) para ${req.solicitante} (${req.folio}).\n\n` +
            `Ya no queda espacio en ese renglón: las demás unidades no se pueden ` +
            `${campo === "comprada" ? "comprar" : "gestionar"} otra vez.`,
        );
      }
      router.refresh();
    } catch {
      alert(`No se pudo actualizar "${titulo}" para ${req.solicitante}. Intenta de nuevo.`);
    } finally {
      // Solo libera ESTE renglón: si otro estaba guardando en paralelo, sigue
      // ocupado el suyo.
      setOcupando((actual) => (actual === req.lineaId ? null : actual));
    }
  }

  // Un renglón siempre nace de una requisición, pero por si acaso no se ofrece
  // un botón que abriría una ventana vacía.
  if (!requisiciones.length) return null;

  const tituloVentana = `Requisiciones que solicitan ${material.nombre}`;

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto(true)}
        className="btn-secundario btn-chico"
        aria-label={`${tituloVentana} (${requisiciones.length})`}
      >
        Ver requisiciones ({requisiciones.length})
      </button>

      {abierto && (
        <div
          className="no-imprimir fixed inset-0 z-[1000] flex items-center justify-center bg-tinta/90 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) {
              desenfocarCampo();
              setAbierto(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tituloVentana}
            className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-superficie shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-borde px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{material.nombre}</p>
                <p className="font-mono text-xs text-tinta2 mt-0.5">{material.codigo}</p>
                <p className="text-xs text-tinta2 mt-1">
                  {requisiciones.length} requisición(es) donde se solicita este material
                </p>
              </div>
              <button
                ref={botonCerrar}
                type="button"
                onClick={() => setAbierto(false)}
                className="btn-secundario btn-chico shrink-0"
                aria-label="Cerrar lista de requisiciones"
              >
                Cerrar
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
              <p className="mb-3 text-xs text-tinta2">
                Indica en <strong className="text-tinta">{titulo}</strong> cuántas unidades de este material se le
                {campo === "comprada" ? " compraron" : " gestionaron"} a cada solicitante. Lo que dejes en 0 queda
                pendiente para esa requisición.
              </p>
              <table className="w-full tabla" style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Solicitante</th>
                    <th className="text-right">Cantidad</th>
                    <th className="text-center">{titulo}</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {requisiciones.map((req) => {
                    const registradas = registradasDe(req);
                    const tope = topeDe(req);
                    const ocupado = ocupando === req.lineaId;
                    return (
                      <tr key={req.id}>
                        <td className="font-mono">
                          <Link
                            href={`/ordenes/${req.id}`}
                            className="text-verde"
                            onClick={() => setAbierto(false)}
                          >
                            {req.folio}
                          </Link>
                        </td>
                        <td>{req.fecha}</td>
                        <td>{req.solicitante}</td>
                        <td className="text-right whitespace-nowrap">
                          <strong>{numero(req.cantidad)}</strong>{" "}
                          <span className="text-tinta2">{req.unidad}</span>
                        </td>
                        <td>
                          <div className="flex flex-col items-center gap-0.5">
                            <input
                              type="number"
                              key={registradas}
                              defaultValue={registradas}
                              min={0}
                              max={Math.max(tope, 0)}
                              step={1}
                              disabled={Boolean(req.bloqueo) || ocupado}
                              aria-label={`${titulo} para ${req.solicitante} (${req.folio})`}
                              title={
                                req.bloqueo ??
                                `${titulo} de ${req.solicitante} — máximo ${Math.max(tope, 0)} de ${req.cantidad}`
                              }
                              className="w-20 px-2 py-1 text-xs text-center border border-borde rounded-lg bg-superficie text-tinta disabled:opacity-60"
                              onBlur={(evento) => aplicar(req, evento.target.value)}
                              onKeyDown={(evento) => {
                                if (evento.key === "Enter") {
                                  evento.preventDefault();
                                  aplicar(req, evento.currentTarget.value);
                                }
                              }}
                            />
                            {/* El otro contador no se puede ver desde aquí si
                                no se le pone su propio campo, así que al menos
                                queda dicho por qué no entra todo lo pedido. */}
                            {req.bloqueo ? (
                              <span className="text-[10px] text-tinta2 text-center leading-tight">{req.bloqueo}</span>
                            ) : campo === "comprada" && req.gestionadas > 0 ? (
                              <span className="text-[10px] text-tinta2">{req.gestionadas} ya gestionada(s)</span>
                            ) : campo === "gestionada" && req.compradas > 0 ? (
                              <span className="text-[10px] text-tinta2">{req.compradas} ya comprada(s)</span>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <span className={"etiqueta " + CLASE_ESTADO[req.estado]}>{req.estado}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="border-t border-borde px-4 py-2 text-center text-xs text-tinta2">
              Clic fuera de la ventana o presiona Esc para cerrar
            </p>
          </div>
        </div>
      )}
    </>
  );
}
