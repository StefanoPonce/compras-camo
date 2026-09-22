import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FormularioEditarUsuario from "./formulario-editar";

export default async function EditarUsuario({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  if (sesion?.user.rol !== "administrador") redirect("/usuarios");

  const u = await prisma.usuario.findUniqueOrThrow({ where: { id: Number(params.id) } });

  return (
    <div className="max-w-md">
      <h2 className="text-xl font-sora font-semibold mb-4">Editar usuario</h2>
      <p className="text-tinta2 text-sm mb-4">Deja la contraseña en blanco si no quieres cambiarla.</p>
      <FormularioEditarUsuario u={u} />
    </div>
  );
}
