// Estados de compra de un material dentro de una requisición.
//
// El estado vive en cada renglón de detalle_orden (ver prisma/schema.prisma)
// en DOS contadores: cantidadGestionada (lo que resolvió Gestión) y
// cantidadComprada (lo que compró Compras). De esos dos salen los estados
// del ciclo que se muestran en el detalle de la requisición, en la lista de
// requisiciones y en el desglose de "Cantidad consolidada":
//
//   Sin aprobar            → requisición todavía NO autorizada: no hay nada
//                            que gestionar ni que comprar (estadoCompraDe).
//   En proceso de gestión → material de una requisición recién aprobada que
//                           todavía nadie ha tocado.
//   Gestionado            → unidades que resolvió Gestión (compra directa,
//                           bodega…). SÍ suman al inventario.
//   En proceso de compra  → unidades sin resolver DESPUÉS de que la
//                           requisición se empezó a trabajar: es lo que le
//                           toca al módulo Compras.
//   Entregado             → unidades que ya compró Compras. SÍ suman al
//                           inventario.
//
// Qué uno de los dos "en proceso" toca se decide por REQUISICIÓN
// (requisicionTrabajada): en cuanto Gestión registra unidades en ALGÚN
// material de una requisición, lo que quede sin resolver en TODA esa
// requisición pasa a "En proceso de compra". Mientras nadie toque nada,
// todo el material se queda en "En proceso de gestión".
//
// Nada de esto se pinta antes de la aprobación: una requisición en
// Borrador, Pendiente o Rechazada muestra "Sin aprobar" (estadoCompraDe),
// porque nadie la ha tomado todavía y "En proceso de gestión" haría
// creer lo contrario.
//
// El enum EstadoGestion (la columna estadoGestion) sigue siendo el RESUMEN
// de los dos contadores, para los filtros y el inventario: "Pendiente"
// mientras falte algo por resolver, "Entregado" si el renglón se resolvió con
// unidades compradas y "Gestionado" si se resolvió solo con Gestión.
//
// La requisición ya NO se cierra sola cuando se resuelven todos sus
// renglones: se queda "Aprobada" y lo que se muestra en pantalla se calcula
// con la regla de estadoVisibleDe() de más abajo ("Pendiente a recibir" o
// "Recibido"). La suma a la existencia tampoco la hace el módulo: la
// registra el sub administrador con "Registrar entrega" (actions.ts →
// recibirOrden).
import type { EstadoGestion, EstadoOrden } from "@prisma/client";

export type { EstadoGestion };

/** Nombre corto que se muestra en pantalla para cada estado de la base. */
export const ETIQUETAS_GESTION: Record<EstadoGestion, string> = {
  Pendiente: "Pendiente de Compra",
  Gestionado: "Gestionado",
  Entregado: "ENTREGADO",
};

/** Estados que maneja el módulo Gestión. La columna Estado ya no ofrece un
 *  desplegable: la consolidación no tiene columna de conteo, el registro por
 *  solicitante vive en la ventana "Ver requisiciones"
 *  (src/app/(app)/gestion/boton-requisiciones-material.tsx). */
export const OPCIONES_GESTION: EstadoGestion[] = ["Pendiente", "Gestionado"];

/** Estados que maneja el módulo Compras: hoy los mismos dos que en Gestión,
 *  pero con su propio contador (cantidadComprada), que deja el renglón en
 *  Entregado. "Entregado" como desplegable ya no se ofrece. */
export const OPCIONES_COMPRA: EstadoGestion[] = ["Pendiente", "Gestionado"];

/* ------------------------------------------------------------------ *
 *  Los estados del ciclo: lo que se muestra en pantalla.
 * ------------------------------------------------------------------ */

/** Ciclo de vida de un material dentro de una requisición. No es el enum de
 *  la base (EstadoGestion tiene tres estados y vive por renglón): son los
 *  que ven el solicitante y los supervisores. Los cuatro primeros son el
 *  ciclo de compra como tal; "SinAprobar" es el estado PREVIO, el que lleva
 *  una requisición mientras nadie la ha autorizado (ver estadoCompraDe). */
export type EstadoCiclo = "SinAprobar" | "EnGestion" | "Gestionado" | "EnCompra" | "Entregado";

/** Nombre que se muestra en pantalla para cada estado del ciclo. */
export const ETIQUETAS_CICLO: Record<EstadoCiclo, string> = {
  SinAprobar: "Sin aprobar",
  EnGestion: "En proceso de gestión",
  Gestionado: "Gestionado",
  EnCompra: "En proceso de compra",
  Entregado: "Entregado",
};

/** Clase de la píldora del estado (ver .et-* en src/app/globals.css).
 *  "Sin aprobar" va gris, como un dato que todavía no arrancó: NO en ámbar,
 *  porque en esta app el ámbar ya significa "en proceso de gestión". */
export const CLASE_CICLO: Record<EstadoCiclo, string> = {
  SinAprobar: "et-borrador",
  EnGestion: "et-pendiente",
  Gestionado: "et-gestionado",
  EnCompra: "et-compra",
  Entregado: "et-entregado",
};

/** Orden en el que se lista el desglose de cantidades: primero lo que ya se
 *  resolvió, al final lo que apenas empieza. "SinAprobar" cierra la lista
 *  porque ni siquiera ha arrancado. */
export const ORDEN_CICLO: EstadoCiclo[] = ["Gestionado", "Entregado", "EnCompra", "EnGestion", "SinAprobar"];

/** Mismo color que la píldora del estado, pero sin fondo: en el desglose la
 *  cifra va suelta debajo del total y un fondo la volvería ruidosa. */
export function colorDeCiclo(estado: EstadoCiclo): string {
  if (estado === "SinAprobar") return "text-tinta2";
  if (estado === "Gestionado") return "text-azul";
  if (estado === "Entregado") return "text-verde";
  if (estado === "EnCompra") return "text-morado";
  return "text-ambar";
}

/** Lo que un renglón de detalle_orden necesita para entrar al ciclo. */
export type RenglonCiclo = {
  cantidad: number;
  cantidadGestionada: number | null;
  cantidadComprada: number | null;
  estadoGestion: EstadoGestion;
  inventariado?: boolean | null;
};

/** Unidades de un material en cada estado del ciclo. Sus valores siempre
 *  suman la cantidad pedida, así que la suma del desglose coincide con la
 *  cifra que tiene al lado. */
export type CantidadesCiclo = Record<EstadoCiclo, number>;

function cantidadesEnCero(): CantidadesCiclo {
  return { SinAprobar: 0, EnGestion: 0, Gestionado: 0, EnCompra: 0, Entregado: 0 };
}

/**
 * ¿La requisición ya se trabajó? En cuanto Gestión registra unidades en
 * ALGÚN material de la requisición, lo que quede sin resolver en TODA ella
 * deja de ser "En proceso de gestión" y pasa a "En proceso de compra". Mientras
 * nadie toque nada (una requisición recién aprobada), todo su material se
 * queda en "En proceso de gestión".
 */
export function requisicionTrabajada(renglones: Iterable<RenglonCiclo>): boolean {
  for (const r of renglones) {
    if ((r.cantidadGestionada || 0) > 0 || (r.cantidadComprada || 0) > 0) return true;
    if (r.estadoGestion !== "Pendiente" || r.inventariado) return true;
  }
  return false;
}

/**
 * Reparto de UN renglón entre los estados del ciclo. `trabajada` es el
 * indicador de SU requisición (ver requisicionTrabajada) y `aprobada` si esa
 * requisición ya fue autorizada.
 *
 * Un renglón puede quedar a la mitad: uno de 2 unidades con
 * cantidadGestionada = 1 aporta 1 a Gestionado y deja 1 para el resto, que
 * va a "En proceso de compra" si la requisición ya se trabajó, a "En proceso
 * de gestión" si todavía no, y a "Sin aprobar" si la requisición ni siquiera
 * fue autorizada.
 *
 * Los dos contadores se recortan al renglón: una cifra mal guardada no puede
 * hacer que la suma del desglose dé más que la cantidad pedida, ni que lo
 * comprado pise lo gestionado.
 */
export function cantidadesDeRenglon(
  r: RenglonCiclo,
  trabajada: boolean,
  aprobada = true,
): CantidadesCiclo {
  const total = cantidadesEnCero();
  const gestionadas = Math.min(Math.max(r.cantidadGestionada || 0, 0), r.cantidad);
  const compradas = Math.min(Math.max(r.cantidadComprada || 0, 0), r.cantidad - gestionadas);
  const restante = r.cantidad - gestionadas - compradas;

  // Renglón ENTREGADO de antes de que existiera el contador de compras: su
  // cantidad entera está en cantidadGestionada (la migración la mueve al
  // contador de compras, esto es el respaldo por si alguna fila quedó atrás).
  // Se reconoce porque el contador de compras está en cero: si ya traía
  // unidades compradas, los dos contadores cuentan la verdad y no hace falta
  // tocar nada.
  if (r.estadoGestion === "Entregado" && compradas === 0) {
    total.Entregado += r.cantidad;
    return total;
  }

  total.Gestionado += gestionadas;
  total.Entregado += compradas;
  // Lo que falta sin resolver: mientras la requisición no esté aprobada no
  // hay ciclo que recorrer, así que va a "Sin aprobar" y no a ninguno de los
  // dos "en proceso".
  if (!aprobada) total.SinAprobar += restante;
  else if (trabajada) total.EnCompra += restante;
  else total.EnGestion += restante;
  return total;
}

/** Reparto de TODOS los renglones de una misma requisición: calcula sola si
 *  esa requisición ya se trabajó. Es lo que muestra el detalle. `aprobada`
 *  la pasa quien sabe el estado de la requisición (ver estadoCompraDe). */
export function cantidadesDeRequisicion(
  renglones: Iterable<RenglonCiclo>,
  aprobada = true,
): CantidadesCiclo {
  const lista = [...renglones];
  const trabajada = requisicionTrabajada(lista);
  const total = cantidadesEnCero();
  for (const r of lista) {
    const reparto = cantidadesDeRenglon(r, trabajada, aprobada);
    for (const estado of ORDEN_CICLO) total[estado] += reparto[estado];
  }
  return total;
}

/** ¿Esta requisición ya fue autorizada? Es la puerta del ciclo de compra:
 *  los estados que se calculan al pintar ("Pendiente a recibir", "Recibido")
 *  salen de una aprobada, así que también pasan. */
export function esRequisicionAprobada(estado: EstadoOrden): boolean {
  return estado === "Aprobada" || estado === "Recibida";
}

/**
 * Estado que se muestra en la lista de requisiciones (una sola píldora para
 * toda la requisición) y en el detalle.
 *
 * Si todavía NO está aprobada la respuesta es "SinAprobar": nadie la ha
 * tomado en cuenta y "En proceso de gestión" haría creer lo contrario.
 *
 * Ya aprobada, manda el ciclo: "En proceso de gestión" si nadie la ha tocado
 * y "En proceso de compra" si ya se empezó a trabajar. Cuando ya no falta
 * nada se resuelve como las filas de Compras: Gestionado si algún renglón lo
 * está, Entregado solo si todo se compró.
 */
export function estadoDeRequisicion(
  renglones: Iterable<RenglonCiclo>,
  aprobada = true,
): EstadoCiclo {
  if (!aprobada) return "SinAprobar";

  const lista = [...renglones];
  if (!lista.length) return "EnGestion";

  const c = cantidadesDeRequisicion(lista, aprobada);
  if (c.EnGestion > 0) return "EnGestion";
  if (c.EnCompra > 0) return "EnCompra";
  if (lista.some((r) => r.estadoGestion === "Gestionado")) return "Gestionado";
  return "Entregado";
}

/**
 * Estado de compra que se pinta para una requisición entera, según SU estado
 * guardado (Borrador, Pendiente, Aprobada, Rechazada, Recibida).
 *
 * Es la única regla que decide si el ciclo existe o no, así que la lista de
 * requisiciones, el detalle y la consolidación de Gestión dicen lo mismo.
 */
export function estadoCompraDe(estado: EstadoOrden, renglones: Iterable<RenglonCiclo>): EstadoCiclo {
  return estadoDeRequisicion(renglones, esRequisicionAprobada(estado));
}

/* ------------------------------------------------------------------ *
 *  Estado de la REQUISICIÓN entera: lo que dice la píldora.
 * ------------------------------------------------------------------ */

/** Lo que puede decir la píldora del estado de una requisición. Son los
 *  valores del enum EstadoOrden más los dos que se CALCULAN al mostrar y
 *  que no existen en la base:
 *
 *    "Pendiente a recibir" → la requisición ya tiene material gestionado o
 *                            comprado, pero el solicitante todavía no
 *                            confirmó que le llegó todo.
 *    "Recibido"            → el solicitante confirmó la recepción de TODOS
 *                            sus renglones.
 *
 *  Se calculan en pantalla a partir de los renglones: no hay migración ni
 *  valor nuevo en EstadoOrden, así que filtros y reportes siguen leyendo la
 *  columna guardada tal cual. */
export type EstadoVisible = EstadoOrden | "Pendiente a recibir" | "Recibido";

/** Lo mínimo que un renglón aporta a ese cálculo: cómo va su compra y si el
 *  solicitante ya confirmó que le llegó. */
export type RenglonRecibo = {
  estadoGestion: EstadoGestion;
  recibidoSolicitante?: boolean | null;
};

/**
 * Estado que se muestra de la requisición entera (lista, detalle, panel y la
 * ventana de requisiciones de Gestión). No cambia lo guardado: se recalcula
 * cada vez que se pinta, con estas reglas, en orden:
 *
 *   1. Borrador, Pendiente y Rechazada se quedan como están: todavía no hay
 *      nada que recibir.
 *   2. Si TODOS los renglones los confirmó el solicitante → "Recibido".
 *   3. Si ALGÚN renglón ya se resolvió (estadoGestion distinto de
 *      Pendiente, o sea gestionado o ENTREGADO) → "Pendiente a recibir".
 *   4. Si no, se queda el estado guardado ("Aprobada": nadie ha tocado nada).
 *
 * Una requisición sin renglones conserva su estado guardado.
 */
export function estadoVisibleDe(estado: EstadoOrden, renglones: Iterable<RenglonRecibo>): EstadoVisible {
  if (estado !== "Aprobada" && estado !== "Recibida") return estado;

  const lista = [...renglones];
  if (!lista.length) return estado;
  if (lista.every((r) => r.recibidoSolicitante)) return "Recibido";
  if (lista.some((r) => r.estadoGestion !== "Pendiente")) return "Pendiente a recibir";
  return estado;
}

/** Clase de la píldora para cada estado visible (ver .et-* en globals.css). */
export const CLASE_ESTADO: Record<EstadoVisible, string> = {
  Borrador: "et-borrador",
  Pendiente: "et-pendiente",
  Aprobada: "et-aprobada",
  Rechazada: "et-rechazada",
  Recibida: "et-recibida",
  "Pendiente a recibir": "et-pendiente-recibir",
  Recibido: "et-recibido",
};

/* ------------------------------------------------------------------ *
 *  El estado guardado en la base (enum EstadoGestion) y sus filtros.
 * ------------------------------------------------------------------ */

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
