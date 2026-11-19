// Catálogo de dependencias de la Fundación CAMO.
//
// Este archivo es la única fuente de verdad: el formulario de requisición arma
// su lista desplegable desde aquí y la hoja impresa usa textoDependencia() para
// traducir lo guardado en la base al texto que se ve en pantalla.
//
// En la base de datos, ordenes_compra.dependencia guarda el `valor`
// ("direccion", todo en minúsculas). Si se imprimiera tal cual saldría
// "direccion" con la primera letra baja; por eso la impresión siempre pasa por
// textoDependencia(), que devuelve la `etiqueta` ("Dirección").

export type Dependencia = {
  /** Valor que se guarda en la base de datos. */
  valor: string;
  /** Nombre como se muestra en el formulario y en la impresión. */
  etiqueta: string;
};

export const DEPENDENCIAS: Dependencia[] = [
  { valor: "direccion", etiqueta: "Dirección" },
  { valor: "subdireccion", etiqueta: "Subdirección" },
  // Solo cambia el TEXTO que se muestra ("Gerencia de…"): el `valor` que se
  // guarda en la base es el mismo de siempre, así que las requisiciones y las
  // cuentas con área ya asignada no se mueven.
  { valor: "gerente financiero", etiqueta: "Gerencia de Finanzas" },
  { valor: "gerente educacion y talento humano", etiqueta: "Gerencia de Educación y Talento Humano" },
  { valor: "gerente mercadeo", etiqueta: "Gerencia de Mercadeo" },
  { valor: "gerente biomedica", etiqueta: "Gerencia de Biomédica" },
  { valor: "gerente operaciones", etiqueta: "Gerencia de Operaciones" },
  { valor: "gerente salud", etiqueta: "Gerencia de Salud" },
];

/** Marca que usa el módulo Usuarios para filtrar las cuentas SIN gerencia
 *  asignada (`?area=sin-area`). No es un valor de la base: solo existe en la
 *  URL del filtro. */
export const SIN_AREA_ASIGNADA = "sin-area";

// Mapa valor → etiqueta, para buscar en O(1) en las pantallas.
const POR_VALOR = new Map<string, string>(
  DEPENDENCIAS.map((d) => [d.valor, d.etiqueta] as const),
);

/** Minúsculas inicial → mayúscula, para lo que no viene del catálogo. */
function capitalizar(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Texto que se imprime para una dependencia: "direccion" → "Dirección".
 *
 * Si el registro no viene del catálogo (requisiciones viejas con texto libre,
 * por ejemplo "servicios"), se muestra tal cual pero con la primera letra en
 * mayúscula, que es lo mínimo para que la hoja no se vea mal.
 */
export function textoDependencia(valor: string | null | undefined): string {
  const v = (valor || "").trim();
  if (!v) return "";

  return (
    POR_VALOR.get(v) ??
    POR_VALOR.get(v.toLowerCase()) ??
    capitalizar(v)
  );
}

/** Valor limpio de una dependencia: sin espacios sobrando. Vacío si no hay. */
export function normalizarDependencia(valor: unknown): string {
  return String(valor ?? "").trim();
}

/** ¿Este valor está en el catálogo? Sirve para validar lo que llega del
 *  formulario de usuarios antes de guardarlo (un área inventada no filtraría
 *  nada: las requisiciones se comparan contra estos mismos valores). */
export function esDependenciaValida(valor: unknown): boolean {
  const v = normalizarDependencia(valor);
  return v === "" || POR_VALOR.has(v);
}
