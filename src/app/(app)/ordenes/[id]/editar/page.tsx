import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo } from "@/lib/permisos";
import FormularioOrden, { type LineaOrden } from "../../formulario-orden";
import { editarOrden } from "../../../actions";
import { normalizarUnidad } from "@/lib/unidades";

export default async function EditarOrden({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes")) redirect("/");
  const puedeTodas = puede(sesion.user.rol, "ordenes.editarTodas");
  const puedeAprobadas = puede(sesion.user.rol, "ordenes.editarAprobadas");
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
  // o quien puede editar todas. Un borrador solo lo continúa quien lo empezó:
  // es un trabajo a medias personal y el resto de la lista ni lo ve.
  if (o.estado === "Recibida") redirect(`/ordenes/${id}`);
  if (o.estado === "Borrador" && o.solicitanteId !== Number(sesion?.user.id)) {
    redirect("/ordenes");
  }
  if (o.estado === "Aprobada" && !puedeAprobadas) redirect(`/ordenes/${id}`);
  if (o.estado !== "Aprobada" && !puedeTodas && o.solicitanteId !== Number(sesion?.user.id)) {
    redirect(`/ordenes/${id}`);
  }

  const esBorrador = o.estado === "Borrador";

  const [materiales, proveedores] = await Promise.all([
    prisma.material.findMany({ include: { proveedor: true }, orderBy: { codigo: "asc" } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  const lineas: LineaOrden[] = o.items.map((it) => ({
    materialId: it.materialId,
    codigo: it.material.codigo,
    nombre: it.material.nombre,
    categoria: it.material.categoria,
    // La unidad guardada en el renglón; los renglones viejos caían al catálogo.
    unidad: normalizarUnidad(it.unidad || it.material.unidad),
    cantidad: it.cantidad,
    // El programa es de cada renglón. Los renglones guardados antes del cambio
    // vienen sin programa y hay que elegirlos de nuevo.
    programa: it.programa || "",
    // El proveedor propio del renglón; en órdenes antiguas (que se guardaron
    // sin esta columna) se toma el de la orden. Un borrador puede no tener
    // ninguno de los dos: entonces el desplegable aparece vacío.
    proveedorId: it.proveedorId ?? o.proveedorId ?? "",
    imagenUrl: it.material.imagenUrl,
    adjuntoUrl: it.adjuntoUrl,
    adjuntoNombre: it.adjuntoNombre,
  }));

  return (
    <>
      <h2 className="text-xl font-sora font-semibold mb-4">
        {esBorrador ? "Continuar requisición" : "Editar requisición"} <span className="font-mono">{o.folio}</span>
      </h2>
      <p className="text-tinta2 text-sm mb-4">
        {esBorrador
          ? "Esta requisición quedó en borrador la última vez. Está todo lo que habías escrito; complétala y envíala cuando esté lista."
          : o.estado === "Aprobada"
          ? "La requisición está aprobada. Al guardar se conserva el estado Aprobada y sigue lista para recibirse."
          : "La requisición está " + o.estado.toLowerCase() + " y puede corregirse. Al guardar quedará pendiente de revisión otra vez."}
      </p>
      <FormularioOrden
        accion={editarOrden.bind(null, id)}
        materiales={materiales}
        proveedores={proveedores}
        inicial={{ dependencia: o.dependencia || "", lugar: o.lugar || "", justificacion: o.justificacion || "", lineas }}
        cancelarHref={`/ordenes/${id}`}
        textoEnviar="Enviar requisición"
        // Una requisición aprobada ya no vuelve a borrador: al corregirla
        // conserva su estado. Los borradores y las pendientes sí pueden
        // seguir guardándose sin completar.
        permitirBorrador={o.estado !== "Aprobada"}
      />
    </>
  );
}