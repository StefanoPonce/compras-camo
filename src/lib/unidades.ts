// Catálogo de unidades de medida del catálogo de materiales.
//
// Es la lista que se ofrece en el formulario de requisición y también la que se
// usa para dejar parejo lo que hay escrito en la tabla "materiales": el
// catálogo tenía CAJA y CAJAS, BOTE y BOTES, PAQUETE/PAQUETES/Paquete y UNIDAD
// y UNIDADES, que en los reportes salían como unidades distintas.
//
// Guardar siempre la forma canónica (en mayúsculas, en singular) hace que dos
// materiales con lo mismo se puedan agrupar y que la lista desplegable nunca
// tenga duplicados.

/** Las unidades que maneja el sistema, en el orden en que se muestran. */
export const UNIDADES = [
  "UNIDAD",
  "PAQUETE",
  "CAJA",
  "BOTE",
  "ROLLO",
  "GALON",
  "RESMA",
  "JERINGA",
  "BOLSA",
  "JUEGO",
  "LATA",
  "BARRA",
  "LIBRA",
  "FARDO",
  "KIT",
] as const;

export type Unidad = (typeof UNIDADES)[number];

export const UNIDAD_POR_DEFECTO: Unidad = "UNIDAD";

const CONOCIDAS = new Set<string>(UNIDADES);

/** Plurales y variantes que se guardaban sueltos y apuntan a la misma unidad. */
const ALIAS: Record<string, Unidad> = {
  UNIDADES: "UNIDAD",
  CAJAS: "CAJA",
  BOTES: "BOTE",
  PAQUETES: "PAQUETE",
};

/**
 * Deja una unidad en su forma canónica: sin espacios sobrantes, en mayúsculas y
 * con el plural correcto. Si no la reconoce tal cual, prueba con los alias
 * ("CAJAS" → "CAJA"). Si tampoco, la devuelve limpia pero sin tocarla, para no
 * perder una unidad que alguien inventó.
 */
export function normalizarUnidad(valor: string | null | undefined): string {
  const limpia = String(valor ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  if (!limpia) return UNIDAD_POR_DEFECTO;
  if (CONOCIDAS.has(limpia)) return limpia;
  return ALIAS[limpia] ?? limpia;
}

/** Cómo se le muestra al usuario: "GALON" se ve como "Galón". */
export function etiquetaUnidad(valor: string | null | undefined): string {
  const canonica = normalizarUnidad(valor);
  const conEspacios = canonica
    .toLowerCase()
    .replace(/(^|\s)([a-záéíóúñ])/g, (_m, espacio: string, letra: string) => espacio + letra.toUpperCase());
  // Un par de unidades se escriben con tilde o con otra forma propia.
  if (canonica === "GALON") return "Galón";
  return conEspacios;
}
