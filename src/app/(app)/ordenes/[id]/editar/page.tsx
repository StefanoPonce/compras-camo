import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puedeVerModulo } from "@/lib/permisos";
import { veLaRequisicion } from "@/lib/alcance-area";
import FormularioOrden, { type LineaOrden } from "../../formulario-orden";
import { editarOrden } from "../../../actions";
import { normalizarUnidad } from "@/lib/unidades";

export default async function EditarOrden({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes")) redirect("/");
  const id = Number(params.id);

  const o = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id },
    include: {
      proveedor: true,
      solicitante: true,
      items: { include: { material: { include: { proveedor: true } } } },
    },
  });

  const esPropia = o.solicitanteId === Number(sesion.user.id);

  // Primer filtro: la requisición le tiene que ser visible (su propia área o
  // la de su gerencia, según veLaRequisicion).
  if (!veLaRequisicion(sesion.user, o)) redirect("/ordenes");
  // Un borrador es un trabajo a medias personal: solo su autor lo continúa.
  if (o.estado === "Borrador" && !esPropia) redirect("/ordenes");
  // Segundo filtro: la edición es exclusiva de QUIEN LA SOLICITÓ. Ningún otro
  // rol —ni el jefe inmediato, ni la administración— llega a este formulario,
  // ni siquiera para las de su propia área.
  if (!esPropia) redirect(`/ordenes/${id}`);
  // Y solo mientras el estado la deja corregir: Pendiente o Rechazada. Una
  // aprobada o recibida manda de vuelta a la vista de la requisición.
  if (o.estado !== "Borrador" && o.estado !== "Pendiente" && o.estado !== "Rechazada") {
    redirect(`/ordenes/${id}`);
  }

  const esBorrador = o.estado === "Borrador";

  const [materiales, proveedores] = await Promise.all([
    // El orden por nombre es la base; el orden definitivo de la lista
    // desplegable lo aplica el formulario (ver ahí el porqué).
    prisma.material.findMany({ include: { proveedor: true }, orderBy: { nombre: "asc" } }),
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
          : "La requisición está " + o.estado.toLowerCase() + " y puede corregirse. Al guardar quedará pendiente de revisión otra vez."}
      </p>
      <FormularioOrden
        accion={editarOrden.bind(null, id)}
        materiales={materiales}
        proveedores={proveedores}
        // La dependencia la manda la cuenta del SOLICITANTE: si tiene gerencia
        // asignada, ese campo queda fijo en el formulario (el administrador es
        // quien la cambia, desde la edición de usuarios).
        dependenciaFija={o.solicitante.area}
        inicial={{ dependencia: o.dependencia || "", area: o.area || "", lugar: o.lugar || "", justificacion: o.justificacion || "", lineas }}
        cancelarHref={`/ordenes/${id}`}
        // Un borrador todavía no se ha enviado: ese botón lo envía por primera
        // vez, así que sigue diciendo "Enviar". Una requisición que ya salió
        // (pendiente o rechazada) solo se corrige, y ahí decir "Enviar"
        // confundía: lo que hace es actualizar la existente.
        textoEnviar={esBorrador ? "Enviar requisición" : "Actualizar requisición"}
      />
    </>
  );
}