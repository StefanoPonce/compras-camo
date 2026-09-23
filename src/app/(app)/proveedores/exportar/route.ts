import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { crearExcelBonito, respuestaExcel } from "@/lib/exportar-excel";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return new Response("No autorizado", { status: 401 });

  const proveedores = await prisma.proveedor.findMany({
    orderBy: [{ nombre: "asc" }, { codigo: "asc" }],
  });

  const archivo = await crearExcelBonito({
    titulo: "Listado de proveedores",
    descripcion: "Fundación CAMO · Proveedores registrados",
    nombreHoja: "Proveedores",
    columnas: [
      { header: "Código", width: 15 },
      { header: "Proveedor", width: 34 },
      { header: "RTN", width: 19 },
      { header: "Tipo de producto", width: 25 },
      { header: "Contacto", width: 25 },
      { header: "Teléfono", width: 17 },
      { header: "Correo", width: 31 },
      { header: "Dirección", width: 40 },
      { header: "Estado", width: 13, horizontal: "center" },
    ],
    filas: proveedores.map((proveedor) => [
      proveedor.codigo ?? "",
      proveedor.nombre,
      proveedor.rtn ?? "",
      proveedor.tipoProducto ?? "",
      proveedor.contacto ?? "",
      proveedor.telefono ?? "",
      proveedor.correo ?? "",
      proveedor.direccion ?? "",
      proveedor.activo ? "Activo" : "Inactivo",
    ]),
    textoTotal: `Total de proveedores: ${proveedores.length}`,
    resaltar: (fila, columna) => {
      if (columna !== 8) return undefined;
      return fila[columna] === "Activo"
        ? { fondo: "FFE2EDE9", texto: "FF12564A", negrita: true }
        : { fondo: "FFF6E6E4", texto: "FF8C2F2A", negrita: true };
    },
  });

  const fecha = new Date().toISOString().slice(0, 10);
  return respuestaExcel(archivo, `proveedores-${fecha}.xlsx`);
}
