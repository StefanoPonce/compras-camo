import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo } from "@/lib/permisos";
import FormularioEditarProveedor from "./formulario-editar";

export default async function EditarProveedor({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "proveedores")) redirect("/proveedores");
  if (!puede(sesion.user.rol, "proveedores.gestionar")) redirect("/proveedores");

  const p = await prisma.proveedor.findUniqueOrThrow({ where: { id: Number(params.id) } });

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-sora font-semibold mb-4">Editar proveedor</h2>
      <FormularioEditarProveedor p={p} />
    </div>
  );
}
