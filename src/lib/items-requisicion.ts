// Lectura de los renglones del formulario de requisición y manejo de los
// adjuntos que el solicitante sube por renglón.
//
// Vive aparte de actions.ts porque son funciones puras de lectura y de
// subida de archivos, sin permisos ni escrituras de la requisición.

import { borrarAdjunto, subirAdjunto } from "@/lib/adjuntos";
import { UNIDAD_POR_DEFECTO, normalizarUnidad } from "@/lib/unidades";

/** Convierte a número un valor del formulario. Si viene vacío, ausente o algo
 *  que no sea un número ("abc", "1,5" mal escrito), se queda en 0. Sin esto,
 *  Number(undefined) devolvería NaN y la cantidad se guardaría mal. */
export function numeroFormulario(valor: FormDataEntryValue | null | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

export type ItemFormulario = {
  materialId: number;
  cantidad: number;
  /** Unidad elegida para este renglón, ya en forma canónica. */
  unidad: string;
  proveedorId: number | null;
  /** Programa de este renglón, como código corto ("2.2"). */
  programa: string | null;
  /** Archivo nuevo que se eligió en esta fila, si hubo. */
  archivo: File | null;
  /** URL del adjunto que ya estaba guardado en esta fila, si sigue en pie. */
  adjuntoActual: string;
  /** El solicitante marcó quitar el adjunto que ya estaba. */
  quitarAdjunto: boolean;
};

export type ItemResuelto = ItemFormulario & {
  adjuntoUrl: string | null;
  adjuntoNombre: string | null;
};

/** Un input file sin elegir llega con nombre vacío y tamaño 0: eso no es un adjunto. */
function archivoElegido(valor: FormDataEntryValue | null | undefined): File | null {
  if (typeof valor !== "object" || valor === null) return null;
  const archivo = valor as File;
  if (typeof archivo.name !== "string" || !archivo.name || archivo.size === 0) return null;
  return typeof archivo.arrayBuffer === "function" ? archivo : null;
}

/**
 * Lee los renglones del formulario, en el mismo orden en que se pintaron.
 *
 * `borrador: true` guarda lo que haya, aunque esté a medias: un renglón con
 * material elegido se conserva aunque su cantidad venga en cero o mal escrita
 * (la columna es NOT NULL en la base, así que se guarda como 1) y aunque no
 * tenga programa. Las filas donde no se eligió material se descartan igual:
 * sin material no hay nada que recuperar después.
 */
export function leerItems(
  datos: FormData,
  { borrador = false }: { borrador?: boolean } = {}
): ItemFormulario[] {
  const materialIds = datos.getAll("materialId") as string[];
  const cantidades = datos.getAll("cantidad") as string[];
  const unidades = datos.getAll("unidad") as string[];
  const proveedores = datos.getAll("proveedorId") as string[];
  const programas = datos.getAll("programa") as string[];

  return materialIds
    .map((mid, i) => ({
      materialId: numeroFormulario(mid),
      cantidad: numeroFormulario(cantidades[i]),
      // La unidad llega del desplegable, pero se normaliza igual por si viene
      // manipulada: en la base siempre queda en forma canónica.
      unidad: normalizarUnidad(unidades[i] ?? UNIDAD_POR_DEFECTO),
      proveedorId: numeroFormulario(proveedores[i]) || null,
      programa: String(programas[i] ?? "").trim() || null,
      // El archivo y la casilla de "quitar" llevan el número de fila en el
      // nombre (adjunto_0, quitarAdjunto_0). Un checkbox desmarcado no viaja en
      // el formulario, así que con un solo nombre las posiciones se correrían
      // y el "quitar" caería en la fila equivocada.
      archivo: archivoElegido(datos.get(`adjunto_${i}`)),
      adjuntoActual: String(datos.get(`adjuntoActual_${i}`) ?? "").trim(),
      quitarAdjunto: datos.get(`quitarAdjunto_${i}`) === "1",
    }))
    .filter((it) => it.materialId && (borrador || it.cantidad > 0))
    .map((it) => (it.cantidad > 0 ? it : { ...it, cantidad: 1 }));
}

/**
 * Sube los adjuntos nuevos de cada renglón y decide qué URL queda en cada uno.
 *
 * `adjuntosConocidos` son los adjuntos que la requisición ya tenía, como mapa
 * url → nombre. Sirve para conservar el que el solicitante no tocó y para
 * comprobar que el campo oculto no venga con la URL de un archivo ajeno.
 *
 * Devuelve también los archivos que sobran en el storage (los reemplazados o
 * los que el solicitante quitó) y los que se subieron, por si el guardado de
 * la requisición falla y hay que deshacer.
 */
export async function resolverAdjuntos(
  items: ItemFormulario[],
  adjuntosConocidos: Map<string, string>
): Promise<{ items: ItemResuelto[]; subidos: string[]; porBorrar: string[] }> {
  const subidos: string[] = [];
  const porBorrar: string[] = [];
  const resueltos: ItemResuelto[] = [];

  for (const item of items) {
    let adjuntoUrl: string | null = null;
    let adjuntoNombre: string | null = null;

    if (item.quitarAdjunto) {
      // Se quita el que estaba y no se sube nada en su lugar.
    } else if (item.archivo) {
      const subido = await subirAdjunto(item.archivo);
      adjuntoUrl = subido.url;
      adjuntoNombre = subido.nombre;
      subidos.push(subido.url);
    } else if (item.adjuntoActual && adjuntosConocidos.has(item.adjuntoActual)) {
      adjuntoUrl = item.adjuntoActual;
      adjuntoNombre = adjuntosConocidos.get(item.adjuntoActual)!;
    }

    // Si el renglón traía un adjunto y acabó con otro (o sin ninguno), el viejo
    // ya no lo usa nadie.
    const previo = item.adjuntoActual;
    if (previo && adjuntosConocidos.has(previo) && previo !== adjuntoUrl) {
      porBorrar.push(previo);
    }

    resueltos.push({ ...item, adjuntoUrl, adjuntoNombre });
  }

  return { items: resueltos, subidos, porBorrar };
}

/** Los campos de un renglón que se mandan a Prisma. */
export function datosRenglon(item: ItemResuelto) {
  return {
    materialId: item.materialId,
    cantidad: item.cantidad,
    unidad: item.unidad,
    proveedorId: item.proveedorId,
    programa: item.programa,
    adjuntoUrl: item.adjuntoUrl,
    adjuntoNombre: item.adjuntoNombre,
  };
}

/** Deshace una subida que quedó a medias, para no dejar archivos huérfanos. */
export async function deshacerSubidas(urls: string[]): Promise<void> {
  await Promise.all(urls.map((url) => borrarAdjunto(url)));
}
