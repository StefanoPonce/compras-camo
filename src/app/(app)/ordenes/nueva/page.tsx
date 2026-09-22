import { prisma } from "@/lib/prisma";
import { crearOrden } from "../../actions";
import FormularioOrden from "../formulario-orden";

export default async function NuevaOrden() {
  const materiales = await prisma.material.findMany({
    include: { proveedor: true },
    orderBy: { codigo: "asc" },
  });

  return (
    <>
      <h2 className="text-xl font-sora font-semibold mb-4">Nueva orden de compra</h2>
      <FormularioOrden
        accion={crearOrden}
        materiales={materiales.map((m) => ({ ...m, precioUltimo: Number(m.precioUltimo) }))}
      />
    </>
  );
}