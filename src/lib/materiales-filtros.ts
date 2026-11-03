import type { Prisma } from "@prisma/client";

/** Filtros del listado de materiales (/materiales y sus exportaciones).
 *  `ex`: "" = todos, "con" = con existencia (> 0), "sin" = sin existencia (= 0).
 *  Existen en un solo lugar para que la pantalla, el Excel y el PDF muestren
 *  exactamente lo mismo. */
export type FiltrosMateriales = { q?: string; cat?: string; ex?: string };

export type FiltrosMaterialesNormalizados = { q: string; cat: string; ex: "con" | "sin" | "" };

export function normalizarFiltrosMateriales(filtros: FiltrosMateriales): FiltrosMaterialesNormalizados {
  return {
    q: (filtros.q || "").trim(),
    cat: (filtros.cat || "").trim(),
    ex: filtros.ex === "con" || filtros.ex === "sin" ? filtros.ex : "",
  };
}

/** Condición de Prisma para el listado; se combina con AND con lo que se necesite. */
export function whereMateriales({
  q,
  cat,
  ex,
}: FiltrosMaterialesNormalizados): Prisma.MaterialWhereInput {
  return {
    AND: [
      q
        ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { codigo: { contains: q, mode: "insensitive" } }] }
        : {},
      cat ? { categoria: cat } : {},
      ex === "con" ? { existencia: { gt: 0 } } : ex === "sin" ? { existencia: 0 } : {},
    ],
  };
}

/** Etiquetas legibles de los filtros activos, para encabezados de impresión,
 *  PDF y Excel ("Búsqueda: "agua" · Categoría: Bebidas · Con existencia"). */
export function describirFiltrosMateriales({ q, cat, ex }: FiltrosMaterialesNormalizados): string {
  return [
    q ? `Búsqueda: "${q}"` : "",
    cat ? `Categoría: ${cat}` : "",
    ex === "con" ? "Con existencia" : ex === "sin" ? "Sin existencia" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Query string de los filtros activos, para que los enlaces de exportación
 *  descarguen lo mismo que se está viendo en pantalla. */
export function paramsMateriales(filtros: FiltrosMaterialesNormalizados): URLSearchParams {
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.cat) params.set("cat", filtros.cat);
  if (filtros.ex) params.set("ex", filtros.ex);
  return params;
}
