import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import FormularioOrden, { type LineaOrden } from "../../formulario-orden";
import { editarOrden } from "../../../actions";

export default async function EditarOrden({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  const esAdmin = sesion?.user.rol === "administrador";
  const id = Number(params.id);

  const o = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id },
    include: {
      proveedor: true,
      solicitante: true,
      items: { include: { material: { include: { proveedor: true } } } },
    },
  });

  if (o.estado !== "Pendiente" && o.estado !== "Rechazada") redirect(`/ordenes/${id}`);
  if (!esAdmin && o.solicitanteId !== Number(sesion?.user.id)) redirect(`/ordenes/${id}`);

  const materiales = await prisma.material.findMany({
    include: { proveedor: true },
    orderBy: { codigo: "asc" },
  });

  const lineas: LineaOrden[] = o.items.map((it) => ({
    materialId: it.materialId,
    codigo: it.material.codigo,
    nombre: it.material.nombre,
    unidad: it.material.unidad,
    precio: Number(it.precio),
    cantidad: it.cantidad,
    proveedor: it.material.proveedor?.nombre || "—",
  }));

  return (
    <>
      <h2 className="text-xl font-sora font-semibold mb-4">
        Editar orden <span className="font-mono">{o.folio}</span>
      </h2>
      <p className="text-tinta2 text-sm mb-4">
        La orden está {o.estado.toLowerCase()} y puede corregirse. Al guardar quedará pendiente de revisión otra vez.
      </p>
      <FormularioOrden
        accion={editarOrden.bind(null, id)}
        materiales={materiales.map((m) => ({ ...m, precioUltimo: Number(m.precioUltimo) }))}
        inicial={{ dependencia: o.dependencia || "", lugar: o.lugar || "", justificacion: o.justificacion || "", lineas }}
        cancelarHref={`/ordenes/${id}`}
        textoEnviar="Guardar cambios"
      />
    </>
  );
}