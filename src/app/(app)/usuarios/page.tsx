import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo, nombreRol, claseRol, normalizarModulos, MODULOS } from "@/lib/permisos";
import FormularioCrearUsuario from "./formulario-crear";
import BotonAlternarUsuario from "./boton-alternar";

export default async function Usuarios() {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "usuarios")) redirect("/");
  if (!puede(sesion.user.rol, "usuarios.gestionar")) redirect("/");

  const usuarios = await prisma.usuario.findMany({
    include: { _count: { select: { movimientos: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <h2 className="text-xl font-sora font-semibold">Usuarios</h2>
      <p className="text-tinta2 text-sm mt-1 mb-4 max-w-[62ch]">
        Quién puede entrar al sistema y con qué permisos. Solo el administrador crea usuarios, da permisos y
        resetea contraseñas; en el panel de cada usuario también puede decidir qué módulos verá.
      </p>

      <FormularioCrearUsuario />

      <div className="tarjeta overflow-x-auto">
        <table className="w-full tabla" style={{ minWidth: 760 }}>
          <thead><tr><th>Nombre</th><th>Cuenta</th><th>Rol</th><th>Módulos</th><th>Estado</th><th className="text-right">Movimientos</th><th></th></tr></thead>
          <tbody>
            {usuarios.map((u) => {
              const modulos = normalizarModulos(u.modulosPermitidos, u.rol);
              return (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong></td>
                  <td className="font-mono">{u.usuario}</td>
                  <td><span className={"etiqueta " + claseRol(u.rol)}>{nombreRol(u.rol)}</span></td>
                  <td>
                    <span className="etiqueta et-variante">
                      {modulos.length === MODULOS.length ? "Todos" : `${modulos.length} módulos`}
                    </span>
                  </td>
                  <td><span className={"etiqueta " + (u.activo ? "et-aprobada" : "et-rechazada")}>{u.activo ? "Activo" : "Desactivado"}</span></td>
                  <td className="text-right">{u._count.movimientos}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/usuarios/${u.id}/editar`} className="btn-secundario btn-chico">Editar</Link>{" "}
                    {String(u.id) !== sesion.user.id && <BotonAlternarUsuario id={u.id} activo={u.activo} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
