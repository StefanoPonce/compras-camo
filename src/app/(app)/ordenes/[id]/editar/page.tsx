import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede } from "@/lib/permisos";
import FormularioOrden, { type LineaOrden } from "../../formulario-orden";
import { editarOrden } from "../../../actions";

export default async function EditarOrden({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  const puedeTodas = puede(sesion?.user.rol, "ordenes.editarTodas");
  const puedeAprobadas = puede(sesion?.user.rol, "ordenes.editarAprobadas");
  const id = Number(params.id);

  const o = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id },
    include: {
      proveedor: true,
      solicitante: true,
      items: { include: { material: { include: { proveedor: true } } } },
    },
  });

  // Recibida nunca se edita; aprobada solo si el rol tiene ese permiso
  // (administrador y sub administrador); pendiente/rechazada, su solicitante
  // o quien puede editar todas.
  if (o.estado === "Recibida") redirect(`/ordenes/${id}`);
  if (o.estado === "Aprobada" && !puedeAprobadas) redirect(`/ordenes/${id}`);
  if (o.estado !== "Aprobada" && !puedeTodas && o.solicitanteId !== Number(sesion?.user.id)) {
    redirect(`/ordenes/${id}`);
  }

  const [materiales, proveedores] = await Promise.all([
    prisma.material.findMany({ include: { proveedor: true }, orderBy: { codigo: "asc" } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const lineas: LineaOrden[] = o.items.map((it) => ({
    materialId: it.materialId,
    codigo: it.material.codigo,
    nombre: it.material.nombre,
    unidad: it.material.unidad,
    precio: Number(it.precio),
    cantidad: it.cantidad,
    // El proveedor propio del renglón; en órdenes antiguas (que se guardaron
    // sin esta columna) se toma el de la orden.
    proveedorId: it.proveedorId ?? o.proveedorId,
    imagenUrl: it.material.imagenUrl,
  }));

  return (
    <>
      <h2 className="text-xl font-sora font-semibold mb-4">
        Editar orden <span className="font-mono">{o.folio}</span>
      </h2>
      <p className="text-tinta2 text-sm mb-4">
        {o.estado === "Aprobada"
          ? "La orden está aprobada. Al guardar se conserva el estado Aprobada y la orden sigue lista para recibirse."
          : "La orden está " + o.estado.toLowerCase() + " y puede corregirse. Al guardar quedará pendiente de revisión otra vez."}
      </p>
      <FormularioOrden
        accion={editarOrden.bind(null, id)}
        materiales={materiales.map((m) => ({ ...m, precioUltimo: Number(m.precioUltimo) }))}
        proveedores={proveedores}
        inicial={{ dependencia: o.dependencia || "", lugar: o.lugar || "", justificacion: o.justificacion || "", lineas }}
        cancelarHref={`/ordenes/${id}`}
        textoEnviar="Guardar cambios"
      />
    </>
  );
}