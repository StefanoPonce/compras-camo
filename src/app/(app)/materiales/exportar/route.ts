import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { crearExcelBonito, respuestaExcel } from "@/lib/exportar-excel";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return new Response("No autorizado", { status: 401 });

  const materiales = await prisma.material.findMany({
    include: { proveedor: { select: { nombre: true } } },
    orderBy: [{ codigo: "asc" }],
  });

  const archivo = await crearExcelBonito({
    titulo: "Listado de materiales",
    descripcion: "Fundación CAMO · Catálogo de materiales e inventario",
    nombreHoja: "Materiales",
    columnas: [
      { header: "Código", width: 15 },
      { header: "Material", width: 34 },
      { header: "Familia", width: 25 },
      { header: "Variante", width: 19 },
      { header: "Categoría", width: 21 },
      { header: "Unidad", width: 15 },
      { header: "Proveedor", width: 31 },
      { header: "Existencia", width: 15, horizontal: "right", numFmt: "#,##0" },
      { header: "Mínimo", width: 13, horizontal: "right", numFmt: "#,##0" },
      { header: "Último precio", width: 18, horizontal: "right", numFmt: '"L" #,##0.00' },
      { header: "Estado", width: 13, horizontal: "center" },
    ],
    filas: materiales.map((material) => [
      material.codigo,
      material.nombre,
      material.familia ?? "",
      material.variante ?? "",
      material.categoria,
      material.unidad,
      material.proveedor?.nombre ?? "",
      material.existencia,
      material.minimo,
      Number(material.precioUltimo),
      material.activo ? "Activo" : "Inactivo",
    ]),
    textoTotal: `Total de materiales: ${materiales.length}`,
    resaltar: (fila, columna) => {
      if (columna === 7 && typeof fila[7] === "number" && typeof fila[8] === "number" && fila[7] <= fila[8]) {
        return { fondo: "FFF6E6E4", texto: "FF8C2F2A", negrita: true };
      }
      if (columna === 10) {
        return fila[columna] === "Activo"
          ? { fondo: "FFE2EDE9", texto: "FF12564A", negrita: true }
          : { fondo: "FFF6E6E4", texto: "FF8C2F2A", negrita: true };
      }
      return undefined;
    },
  });

  const fecha = new Date().toISOString().slice(0, 10);
  return respuestaExcel(archivo, `materiales-${fecha}.xlsx`);
}
