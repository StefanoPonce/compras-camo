// Materiales que son "propios" de un usuario para el inventario.
//
// El rol responsable de solicitar solo ve su inventario: los materiales que
// aparecen en las requisiciones que él envió (lo que pidió y lo que ya le
// recibieron) y los descargos que él mismo registró. Este archivo reúne la
// consulta que responde "¿de qué materiales hablamos?" para que el panel, el
// módulo de inventario y el catálogo digan lo mismo.
import { prisma } from "@/lib/prisma";

/**
 * Ids de los materiales de las requisiciones enviadas por un usuario.
 *
 * Un borrador no cuenta: es un trabajo a medias que todavía no se pidió, así
 * que su material no forma parte de lo que a este usuario le corresponde en
 * bodega.
 */
export async function materialesSolicitadosPor(usuarioId: number): Promise<number[]> {
  const renglones = await prisma.detalleOrden.findMany({
    where: { orden: { solicitanteId: usuarioId, estado: { not: "Borrador" } } },
    select: { materialId: true },
    distinct: ["materialId"],
    orderBy: { materialId: "asc" },
  });
  return renglones.map((r) => r.materialId);
}

/** Condición de Prisma para limitar una consulta de materiales a los propios.
 *  Devuelve un objeto vacío cuando `propios` no restringe nada. */
export function filtroMaterialesPropios(propios: number[] | null): { id?: { in: number[] } } {
  return propios ? { id: { in: propios } } : {};
}
