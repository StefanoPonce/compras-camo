// Estados de compra de un material dentro de una requisición.
//
// El estado vive en cada renglón de detalle_orden (ver prisma/schema.prisma)
// y se muestra consolidado por material en los módulos Gestión y Compras:
//
//   Pendiente   → "Pendiente de Compra": es el estado de todo material
//                 recién aprobado y es el que pasa al módulo Compras. NO
//                 entra al inventario y mantiene la requisición abierta.
//   Gestionado  → quien gestiona ya lo resolvió (compra directa, bodega,
//                 etc.). SÍ suma al inventario cuando el sub administrador
//                 registra la entrega.
//   Entregado   → estado que tenía Compras antes: ya no se ofrece en la
//                 interfaz (hoy Compras marca Gestionado, igual que Gestión),
//                 pero sigue siendo válido para los renglones marcados antes.
//                 SÍ suma al inventario al registrar la entrega.
//
// Cuando una requisición ya no tiene ningún renglón Pendiente (todos están
// Gestionados o Entregados) pasa sola a Recibida. La suma a la existencia NO
// la hace el módulo: la registra el sub administrador con "Registrar entrega"
// y solo cuenta los renglones que falten (actions.ts → recibirOrden).
import type { EstadoGestion } from "@prisma/client";

export type { EstadoGestion };

/** Nombre que se muestra en pantalla para cada estado. */
export const ETIQUETAS_GESTION: Record<EstadoGestion, string> = {
  Pendiente: "Pendiente de Compra",
  Gestionado: "Gestionado",
  Entregado: "ENTREGADO",
};

/**
 * Lo que ve quien pidió el material: el detalle y la lista de sus
 * requisiciones. Mismo estado, dicho en términos del solicitante, para que se
 * entienda que el equipo ya lo está atendiendo ("Pendiente de Compra" suena a
 * que nadie ha tocado nada). Gestión y Compras siguen usando
 * ETIQUETAS_GESTION: ellos trabajan con ese término.
 */
export const ETIQUETAS_REQUISICION: Record<EstadoGestion, string> = {
  ...ETIQUETAS_GESTION,
  Pendiente: "En proceso de gestión",
};

/** Lo que se puede elegir en el módulo Gestión (sin la entrega). */
export const OPCIONES_GESTION: EstadoGestion[] = ["Pendiente", "Gestionado"];

/** Lo que se puede elegir en el módulo Compras: hoy los mismos dos que en
 *  Gestión. "Entregado" ya no se ofrece (la recepción formal la registra el
 *  sub administrador con "Registrar entrega"), pero sigue siendo un estado
 *  válido para los renglones que se marcaron antes. */
export const OPCIONES_COMPRA: EstadoGestion[] = ["Pendiente", "Gestionado"];

/** Color de la píldora del estado. */
export function claseEstadoGestion(estado: EstadoGestion): string {
  if (estado === "Gestionado") return "et-gestionado";
  if (estado === "Entregado") return "et-entregado";
  return "et-pendiente";
}

/**
 * Estado que se muestra en una fila de la consolidación: la fila junta varios
 * renglones (una requisición por cada proveedor que pidió el material) y no
 * siempre traen el mismo estado. Manda lo conservador: si alguno sigue
 * pendiente, la fila está pendiente.
 */
export function estadoDeFila(estados: Iterable<EstadoGestion>): EstadoGestion {
  const lista = [...estados];
  if (!lista.length) return "Pendiente";
  if (lista.includes("Pendiente")) return "Pendiente";
  if (lista.includes("Gestionado")) return "Gestionado";
  return "Entregado";
}

/** ¿Se puede cambiar el estado de un material? Solo lo que está en la lista. */
export function esEstadoGestion(valor: unknown): valor is EstadoGestion {
  return valor === "Pendiente" || valor === "Gestionado" || valor === "Entregado";
}

/** Filtros de estado del módulo Compras (parámetro "estado" de la URL). */
export type FiltroEstadoCompras = "pendiente" | "entregado" | "todos";

export const FILTROS_COMPRAS: { valor: FiltroEstadoCompras; etiqueta: string }[] = [
  { valor: "pendiente", etiqueta: "Pendientes de compra" },
  { valor: "entregado", etiqueta: "Entregados" },
  { valor: "todos", etiqueta: "Todos" },
];

export function normalizarFiltroEstadoCompras(valor?: string): FiltroEstadoCompras {
  return valor === "entregado" || valor === "todos" ? valor : "pendiente";
}

/** Estado al que corresponde una fila para cada filtro de Compras. */
export function coincideFiltro(estado: EstadoGestion, filtro: FiltroEstadoCompras): boolean {
  if (filtro === "todos") return true;
  if (filtro === "entregado") return estado === "Entregado";
  return estado === "Pendiente";
}
