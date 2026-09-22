// Todo movimiento importante del sistema pasa por aquí.
// La tabla `movimientos` solo se inserta, nunca se edita ni se borra.
import { prisma } from "@/lib/prisma";

export async function registrarMovimiento(datos: {
  usuarioId: number;
  modulo: string;
  accion: string;
  detalle?: string;
}) {
  const usuario = await prisma.usuario.findUnique({ where: { id: datos.usuarioId } });
  await prisma.movimiento.create({
    data: {
      usuarioId: datos.usuarioId,
      usuarioTxt: usuario?.nombre ?? "Desconocido",
      rolTxt: usuario?.rol ?? "—",
      modulo: datos.modulo,
      accion: datos.accion,
      detalle: datos.detalle ?? "",
    },
  });
}
