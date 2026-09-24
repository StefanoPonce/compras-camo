import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puedeVerModulo } from "@/lib/permisos";
import { crearOrden } from "../../actions";
import FormularioOrden from "../formulario-orden";

export default async function NuevaOrden() {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes")) redirect("/");

  const [materiales, proveedores] = await Promise.all([
    prisma.material.findMany({ include: { proveedor: true }, orderBy: { codigo: "asc" } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return (
    <>
      <h2 className="text-xl font-sora font-semibold mb-4">Nueva requisición</h2>
      <FormularioOrden
        accion={crearOrden}
        materiales={materiales.map((m) => ({ ...m, precioUltimo: Number(m.precioUltimo) }))}
        proveedores={proveedores}
      />
    </>
  );
}