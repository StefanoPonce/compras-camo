import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo } from "@/lib/permisos";
import FormularioEditarMaterial from "./formulario-editar";

export default async function EditarMaterial({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "materiales")) redirect("/materiales");
  if (!puede(sesion.user.rol, "materiales.gestionar")) redirect("/materiales");

  const [m, proveedores, familiasBrutas] = await Promise.all([
    prisma.material.findUniqueOrThrow({ where: { id: Number(params.id) } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
    prisma.material.findMany({
      where: { familia: { not: null } },
      select: { familia: true },
      distinct: ["familia"],
      orderBy: { familia: "asc" },
    }),
  ]);
  const familias = familiasBrutas.map((f) => f.familia).filter((f): f is string => Boolean(f));

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-sora font-semibold mb-4">Editar material</h2>
      <FormularioEditarMaterial
        m={{ ...m, precioUltimo: Number(m.precioUltimo), imagenUrl: m.imagenUrl }}
        proveedores={proveedores}
        familias={familias}
      />
    </div>
  );
}
