import { prisma } from "@/lib/prisma";
import NuevoFormulario from "./nuevo-formulario";

export default async function NuevaOrden() {
  const [proveedores, materiales] = await Promise.all([
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.material.findMany({ orderBy: { codigo: "asc" } }),
  ]);

  return (
    <>
      <h2 className="text-xl font-sora font-semibold mb-4">Nueva orden de compra</h2>
      <NuevoFormulario
        proveedores={proveedores}
        materiales={materiales.map((m) => ({ ...m, precioUltimo: Number(m.precioUltimo) }))}
      />
    </>
  );
}
