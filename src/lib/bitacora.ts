// Todo movimiento importante del sistema pasa por aquí.
// La tabla `movimientos` solo se inserta, nunca se edita ni se borra.
import { prisma } from "@/lib/prisma";
import { nombreRol } from "@/lib/permisos";

export async function registrarMovimiento(datos: {
  usuarioId: number;
  modulo: string;
  accion: string;
  detalle?: string;
}) {
  const usuario = await prisma.usuario.findUnique({ where: { id: datos.usuarioId } });
  await prisma.movimiento.create({
    data: {
      // Si el id de la sesión ya no apunta a ningún usuario (base
      // resembrada), el movimiento se guarda igual con la firma en texto:
      // la bitácora no debe tumbar la acción que estaba registrando.
      usuarioId: usuario?.id ?? null,
      usuarioTxt: usuario?.nombre ?? "Desconocido",
      rolTxt: usuario ? nombreRol(usuario.rol) : "—",
      modulo: datos.modulo,
      accion: datos.accion,
      detalle: datos.detalle ?? "",
    },
  });
}
