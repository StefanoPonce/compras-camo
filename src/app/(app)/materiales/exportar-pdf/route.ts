import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puedeVerModulo } from "@/lib/permisos";
import { crearListadoPdf, type ValorPdf } from "@/lib/exportar-pdf";
import { describirFiltrosMateriales, normalizarFiltrosMateriales, whereMateriales } from "@/lib/materiales-filtros";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Descarga el catálogo de materiales como PDF, sin pasar por el diálogo de
 *  impresión del navegador: el archivo se arma en el servidor y llega como
 *  descarga normal. Respeta los mismos filtros que la pantalla. */
export async function GET(request: Request) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return new Response("No autorizado", { status: 401 });
  if (!puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "materiales")) {
    return new Response("No autorizado", { status: 403 });
  }

  const filtros = normalizarFiltrosMateriales(Object.fromEntries(new URL(request.url).searchParams));

  const materiales = await prisma.material.findMany({
    where: whereMateriales(filtros),
    include: { proveedor: { select: { nombre: true } } },
    orderBy: [{ codigo: "asc" }],
  });

  const filas: ValorPdf[][] = materiales.map((m) => [
    m.codigo,
    m.nombre,
    m.categoria,
    m.unidad,
    m.proveedor?.nombre ?? "",
    m.existencia,
    m.minimo,
    m.activo ? "Activo" : "Inactivo",
  ]);

  const fecha = new Date();
  const detalleFiltros = describirFiltrosMateriales(filtros);
  const bytes = await crearListadoPdf({
    titulo: "Listado de materiales",
    subtitulo: [
      `Fundación CAMO · Catálogo de materiales e inventario · ${materiales.length} material(es) · generado el ${fecha.toLocaleDateString("es-HN", { day: "2-digit", month: "long", year: "numeric" })}`,
      detalleFiltros,
    ]
      .filter(Boolean)
      .join(" · "),
    columnas: [
      { titulo: "Código", peso: 65 },
      { titulo: "Material", peso: 155 },
      { titulo: "Categoría", peso: 120 },
      { titulo: "Unidad", peso: 75 },
      { titulo: "Proveedor", peso: 135 },
      { titulo: "Existencia", peso: 65, alinear: "der" },
      { titulo: "Mínimo", peso: 55, alinear: "der" },
      { titulo: "Estado", peso: 55, alinear: "centro" },
    ],
    filas,
    // Igual que en pantalla: existencia en rojo cuando está en el mínimo, y
    // la píldora de estado con sus colores.
    celda: (fila, columna, valor) => {
      if (columna === 5) {
        const minimo = Number(filas[fila]?.[6] ?? 0);
        return Number(valor) <= minimo
          ? { fondo: "#F6E6E4", texto: "#8C2F2A", negrita: true }
          : undefined;
      }
      if (columna === 7) {
        return valor === "Activo"
          ? { fondo: "#E2EDE9", texto: "#12564A", negrita: true }
          : { fondo: "#F6E6E4", texto: "#8C2F2A", negrita: true };
      }
      return undefined;
    },
    pie: `Total de materiales: ${materiales.length} · ${sesion.user.name || sesion.user.usuario}`,
  });

  const nombre = `materiales-${fecha.toISOString().slice(0, 10)}.pdf`;
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
