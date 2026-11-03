import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puedeVerModulo } from "@/lib/permisos";
import { crearListadoPdf } from "@/lib/exportar-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Descarga el listado de proveedores como PDF, sin pasar por el diálogo de
 *  impresión del navegador: el archivo se arma en el servidor y llega como
 *  descarga normal. */
export async function GET() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) return new Response("No autorizado", { status: 401 });
  if (!puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "proveedores")) {
    return new Response("No autorizado", { status: 403 });
  }

  const proveedores = await prisma.proveedor.findMany({
    orderBy: [{ nombre: "asc" }, { codigo: "asc" }],
  });

  const fecha = new Date();
  const bytes = await crearListadoPdf({
    titulo: "Listado de proveedores",
    subtitulo: `Fundación CAMO · ${proveedores.length} proveedor(es) · generado el ${fecha.toLocaleDateString("es-HN", { day: "2-digit", month: "long", year: "numeric" })}`,
    columnas: [
      { titulo: "Código", peso: 60 },
      { titulo: "Proveedor", peso: 135 },
      { titulo: "RTN", peso: 90 },
      { titulo: "Cuenta bancaria", peso: 95 },
      { titulo: "Tipo de producto", peso: 95 },
      { titulo: "Contacto", peso: 90 },
      { titulo: "Teléfono", peso: 65 },
      { titulo: "Correo", peso: 105 },
      { titulo: "Dirección", peso: 130 },
      { titulo: "Estado", peso: 55, alinear: "centro" },
    ],
    filas: proveedores.map((p) => [
      p.codigo ?? "",
      p.nombre,
      p.rtn ?? "",
      p.cuentaBancaria ?? "",
      p.tipoProducto ?? "",
      p.contacto ?? "",
      p.telefono ?? "",
      p.correo ?? "",
      p.direccion ?? "",
      p.activo ? "Activo" : "Inactivo",
    ]),
    // Misma codificación de estado que en pantalla y en el Excel.
    celda: (_fila, columna, valor) => {
      if (columna !== 9) return undefined;
      return valor === "Activo"
        ? { fondo: "#E2EDE9", texto: "#12564A", negrita: true }
        : { fondo: "#F6E6E4", texto: "#8C2F2A", negrita: true };
    },
    pie: `Total de proveedores: ${proveedores.length} · ${sesion.user.name || sesion.user.usuario}`,
  });

  const nombre = `proveedores-${fecha.toISOString().slice(0, 10)}.pdf`;
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
