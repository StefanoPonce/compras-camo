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
  { valor: "gerente financiero", etiqueta: "Gerente Financiero" },
  { valor: "gerente educacion y talento humano", etiqueta: "Gerente Educación y Talento Humano" },
  { valor: "gerente mercadeo", etiqueta: "Gerente Mercadeo" },
  { valor: "gerente biomedica", etiqueta: "Gerente Biomédica" },
  { valor: "gerente operaciones", etiqueta: "Gerente Operaciones" },
  { valor: "gerente salud", etiqueta: "Gerente Salud" },
];

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
