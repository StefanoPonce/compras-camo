import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  FILTROS_CONSOLIDACION,
  normalizarFiltroConsolidacion,
  obtenerConsolidacion,
  unidadesDe,
} from "@/lib/consolidacion";
import { crearExcelBonito, respuestaExcel } from "@/lib/exportar-excel";
import { puede, puedeVerModulo } from "@/lib/permisos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return new Response("No autorizado", { status: 401 });
  if (!puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "gestion")) {
    return new Response("No autorizado", { status: 403 });
  }
  if (!puede(sesion.user.rol, "consolidacion.ver")) return new Response("No autorizado", { status: 403 });

  const url = new URL(request.url);
  const filtro = normalizarFiltroConsolidacion(url.searchParams.get("estado") || undefined);
  const q = url.searchParams.get("q") || "";
  const { grupos } = await obtenerConsolidacion({ filtro, q });
  const nombreFiltro = FILTROS_CONSOLIDACION.find((opcion) => opcion.valor === filtro)?.etiqueta || "Aprobadas";
  const filas = grupos.flatMap((grupo) =>
    grupo.items.map((item) => {
      const folios = [...item.folios];
      return [
        grupo.proveedor?.codigo ?? "",
        grupo.proveedor?.nombre ?? "Sin proveedor",
        item.material.codigo,
        item.material.nombre,
        item.material.variante ?? "",
        unidadesDe(item.unidades),
        item.cantidad,
        folios.join(", "),
        folios.length > 1 ? `Consolidado de ${folios.length} órdenes` : "Una orden",
      ];
    })
  );
  const unidadesGeneral = grupos.reduce((suma, grupo) => suma + grupo.unidades, 0);

  const archivo = await crearExcelBonito({
    titulo: "Consolidación de compras",
    descripcion: `Fundación CAMO · Requisiciones ${nombreFiltro.toLowerCase()}`,
    nombreHoja: "Consolidación",
    columnas: [
      { header: "Código proveedor", width: 17 },
      { header: "Proveedor", width: 32 },
      { header: "Código material", width: 17 },
      { header: "Material", width: 32 },
      { header: "Variante", width: 18 },
      { header: "Unidad", width: 13 },
      { header: "Cantidad consolidada", width: 20, horizontal: "right", numFmt: "#,##0" },
      { header: "Folios de origen", width: 28 },
      { header: "Consolidación", width: 25, horizontal: "center" },
    ],
    filas,
    textoTotal: `Unidades consolidadas: ${unidadesGeneral}`,
    resaltar: (_fila, columna) => {
      if (columna === 8) {
        return { fondo: "FFF6EEDC", texto: "FF8A6114", negrita: true };
      }
      return undefined;
    },
  });

  const fecha = new Date().toISOString().slice(0, 10);
  return respuestaExcel(archivo, `consolidacion-compras-${fecha}.xlsx`);
}
