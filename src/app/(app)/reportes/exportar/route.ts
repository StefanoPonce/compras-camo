import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { crearExcelConHojas, respuestaExcel } from "@/lib/exportar-excel";
import type { HojaExcel } from "@/lib/exportar-excel";
import { puede, puedeVerModulo } from "@/lib/permisos";
import {
  etiquetaFiltro,
  fecha,
  hoy,
  obtenerReporte,
  primerDiaDelMes,
} from "@/lib/reportes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Descarga el reporte que se está viendo en pantalla, con los mismos filtros
 * (tipo de reporte, período y estados incluidos). El Excel lleva una hoja por
 * cada tabla del reporte.
 */
export async function GET(request: Request) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return new Response("No autorizado", { status: 401 });
  if (!puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "reportes")) {
    return new Response("No autorizado", { status: 403 });
  }
  if (!puede(sesion.user.rol, "reportes.ver")) return new Response("No autorizado", { status: 403 });

  const url = new URL(request.url);
  const desde = url.searchParams.get("desde") || primerDiaDelMes();
  const hasta = url.searchParams.get("hasta") || hoy();
  const estado = url.searchParams.get("estado") || "AR";
  const esInsumos = url.searchParams.get("reporte") === "insumos";

  const datos = await obtenerReporte({ desde, hasta, estado });

  const titulo = esInsumos ? "Reporte de insumos comprados" : "Reporte de gestión de compras";
  const descripcion = `Fundación CAMO · Del ${fecha(desde)} al ${fecha(hasta)} · ${etiquetaFiltro(estado)}`;

  const hojas: HojaExcel[] = esInsumos
    ? [
        {
          nombreHoja: "Por material",
          titulo: "Insumos comprados por material",
          columnas: [
            { header: "Código", width: 17 },
            { header: "Material", width: 38 },
            { header: "Categoría", width: 22 },
            { header: "Unidad", width: 16 },
            { header: "Cantidad", width: 14, horizontal: "right", numFmt: "#,##0" },
            { header: "Requisiciones", width: 15, horizontal: "right", numFmt: "#,##0" },
          ],
          filas: datos.filasMaterial.map((m) => [
            m.material.codigo,
            m.material.nombre,
            m.material.categoria,
            m.unidades,
            m.cantidad,
            m.requisiciones,
          ]),
          textoTotal: `Unidades compradas: ${datos.unidadesCompradas} · Materiales distintos: ${datos.filasMaterial.length}`,
        },
        {
          nombreHoja: "Por categoría",
          titulo: "Por categoría de material",
          columnas: [
            { header: "Categoría", width: 26 },
            { header: "Unidades compradas", width: 20, horizontal: "right", numFmt: "#,##0" },
            { header: "Materiales distintos", width: 20, horizontal: "right", numFmt: "#,##0" },
          ],
          filas: datos.filasCategoria.map((c) => [c.categoria, c.cantidad, c.materiales]),
          textoTotal: `Unidades compradas: ${datos.unidadesCompradas}`,
        },
      ]
    : [
        {
          nombreHoja: "Por estado",
          titulo: "Requisiciones por estado",
          columnas: [
            { header: "Estado", width: 20 },
            { header: "Requisiciones", width: 16, horizontal: "right", numFmt: "#,##0" },
            { header: "Unidades", width: 16, horizontal: "right", numFmt: "#,##0" },
          ],
          filas: datos.filasEstado.map((f) => [f.estado, f.cant, f.unidades]),
          textoTotal: `Requisiciones incluidas: ${datos.ordenes.length}`,
        },
        {
          nombreHoja: "Por proveedor",
          titulo: "Materiales por proveedor",
          columnas: [
            { header: "Proveedor", width: 36 },
            { header: "Requisiciones", width: 16, horizontal: "right", numFmt: "#,##0" },
            { header: "Materiales distintos", width: 20, horizontal: "right", numFmt: "#,##0" },
            { header: "Unidades", width: 15, horizontal: "right", numFmt: "#,##0" },
            { header: "% de las unidades", width: 20, horizontal: "right", numFmt: "0.0" },
          ],
          filas: datos.filasProveedor.map((p) => [
            p.nombre,
            p.ordenes,
            p.materiales,
            p.unidades,
            datos.unidadesCompradas ? Number(((p.unidades / datos.unidadesCompradas) * 100).toFixed(1)) : 0,
          ]),
          textoTotal: `Unidades en el período: ${datos.unidadesCompradas}`,
          resaltar: (fila, columna) => {
            // "Sin proveedor" son requisiciones a las que todavía hay que
            // asignarle proveedor: se marcan para que no se pierdan de vista.
            if (columna === 0 && fila[0] === "Sin proveedor") {
              return { fondo: "FFF6EEDC", texto: "FF8A6114", negrita: true };
            }
            return undefined;
          },
        },
      ];

  const archivo = await crearExcelConHojas({ titulo, descripcion, hojas });

  const marca = new Date().toISOString().slice(0, 10);
  const nombre = esInsumos ? `reporte-insumos-${marca}.xlsx` : `reporte-gestion-${marca}.xlsx`;
  return respuestaExcel(archivo, nombre);
}
