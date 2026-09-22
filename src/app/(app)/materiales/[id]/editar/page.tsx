import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FormularioEditarMaterial from "./formulario-editar";

export default async function EditarMaterial({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  if (sesion?.user.rol !== "administrador") redirect("/materiales");

  const [m, proveedores] = await Promise.all([
    prisma.material.findUniqueOrThrow({ where: { id: Number(params.id) } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-sora font-semibold mb-4">Editar material</h2>
      <FormularioEditarMaterial m={{ ...m, precioUltimo: Number(m.precioUltimo) }} proveedores={proveedores} />
    </div>
  );
}
