"use client";
// Botón de cada renglón de la consolidación de Gestión: abre una ventana con
// la lista de requisiciones donde se está solicitando ese material (folio,
// fecha, solicitante, cantidad pedida y estado), sin salir de la página.
//
// La lista es exactamente la que indica la columna "Origen" de la fila: las
// requisiciones de ese grupo de proveedor que traen el material, de modo que
// lo que se ve en la ventana coincide con lo que se imprime en el consolidado.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type RequisicionDelMaterial = {
  id: number;
  folio: string;
  /** Fecha ya formateada en el servidor (es-HN). */
  fecha: string;
  estado: string;
  solicitante: string;
  /** Lo que pide esta requisición de este material (no la suma consolidada). */
  cantidad: number;
  unidad: string;
};

type Props = {
  material: { nombre: string; codigo: string };
  requisiciones: RequisicionDelMaterial[];
};

function numero(n: number) {
  return n.toLocaleString("es-HN");
}

export default function BotonRequisicionesMaterial({ material, requisiciones }: Props) {
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!abierto) return;

    const elementoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowAnterior = document.body.style.overflow;
    const alPresionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
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

  // Un renglón siempre nace de una requisición, pero por si acaso no se ofrece
  // un botón que abriría una ventana vacía.
  if (!requisiciones.length) return null;

  const titulo = `Requisiciones que solicitan ${material.nombre}`;

  return (
    <>
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto(true)}
        className="btn-secundario btn-chico"
        aria-label={`${titulo} (${requisiciones.length})`}
      >
        Ver requisiciones ({requisiciones.length})
      </button>

      {abierto && (
        <div
          className="no-imprimir fixed inset-0 z-[1000] flex items-center justify-center bg-tinta/90 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setAbierto(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-superficie shadow-2xl"
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
              <table className="w-full tabla" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Solicitante</th>
                    <th className="text-right">Cantidad</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {requisiciones.map((req) => (
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
                        <span className={"etiqueta et-" + req.estado.toLowerCase()}>{req.estado}</span>
                      </td>
                    </tr>
                  ))}
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
