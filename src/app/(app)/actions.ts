"use server";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarMovimiento } from "@/lib/bitacora";
import {
  puede,
  rolValido,
  MODULOS_DEL_ROL,
  MODULOS_POR_ROL,
  MODULO_DE_PERMISO,
  puedeVerModulo,
  type Permiso,
} from "@/lib/permisos";
import { leerImagenAdjunta, subirImagenMaterial, borrarImagenMaterial } from "@/lib/imagenes";
import { borrarAdjunto } from "@/lib/adjuntos";
import { normalizarUnidad } from "@/lib/unidades";
import {
  datosRenglon,
  deshacerSubidas,
  leerItems as leerItemsDelFormulario,
  resolverAdjuntos,
} from "@/lib/items-requisicion";

export type EstadoForm = { error: string | null };

async function sesionObligatoria() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) redirect("/login");

  const id = Number(sesion.user.id);
  const existe = Number.isInteger(id)
    ? await prisma.usuario.findUnique({ where: { id }, select: { id: true, activo: true } })
    : null;
  if (!existe || !existe.activo) redirect("/login");

  return sesion;
}

async function exigirPermiso(permiso: Permiso) {
  const sesion = await sesionObligatoria();
  if (!puede(sesion.user.rol, permiso)) {
    throw new Error("Tu rol no tiene permiso para esta acción.");
  }
  const modulo = MODULO_DE_PERMISO[permiso];
  if (modulo && !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, modulo)) {
    throw new Error("No tienes acceso al módulo requerido para esta acción.");
  }
  return sesion;
}

function enteroDelFormulario(valor: unknown, porDefecto: number): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return porDefecto;
  const n = Number(texto);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function mensajeSiEsDuplicado(e: unknown, camposLegibles: Record<string, string>): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const objetivo = (e.meta?.target as string[] | undefined) || [];
    const campo = objetivo.find((c) => camposLegibles[c]);
    if (campo) return `Ya existe un registro con ese ${camposLegibles[campo]}. Usa otro valor.`;
    return "Ya existe un registro con ese dato. Usa otro valor.";
  }
  throw e;
}

async function siguienteCodigoProveedor(): Promise<string> {
  const existentes = await prisma.proveedor.findMany({ select: { codigo: true } });
  const usados = new Set(existentes.map((p) => p.codigo).filter((c): c is string => Boolean(c)));
  let n = 1;
  while (usados.has(`PROV-${String(n).padStart(3, "0")}`)) n++;
  return `PROV-${String(n).padStart(3, "0")}`;
}

export async function crearProveedor(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("proveedores.gestionar");
  const nombre = String(datos.get("nombre") || "").trim();
  if (!nombre) return { error: "El nombre del proveedor es obligatorio." };

  const repetido = await prisma.proveedor.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } });
  if (repetido) return { error: `Ya existe un proveedor llamado "${repetido.nombre}". Usa un nombre distinto o edita el existente.` };

  try {
    const proveedor = await prisma.proveedor.create({
      data: {
        codigo: String(datos.get("codigo") || "").trim() || (await siguienteCodigoProveedor()),
        nombre,
        rtn: String(datos.get("rtn") || "").trim() || null,
        contacto: String(datos.get("contacto") || "").trim() || null,
        telefono: String(datos.get("telefono") || "").trim() || null,
        correo: String(datos.get("correo") || "").trim() || null,
        direccion: String(datos.get("direccion") || "").trim() || null,
        tipoProducto: String(datos.get("tipoProducto") || "").trim() || null,
      },
    });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Proveedores", accion: "Registró proveedor",
      detalle: `${proveedor.nombre} (${proveedor.codigo})${proveedor.rtn ? " — RTN " + proveedor.rtn : ""}`,
    });
  } catch (e) {
    return { error: mensajeSiEsDuplicado(e, { rtn: "RTN", codigo: "código" }) };
  }

  revalidatePath("/proveedores");
  return { error: null };
}

export async function editarProveedor(id: number, _prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("proveedores.gestionar");
  const nombre = String(datos.get("nombre") || "").trim();
  if (!nombre) return { error: "El nombre del proveedor es obligatorio." };

  const repetido = await prisma.proveedor.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, NOT: { id } },
  });
  if (repetido) return { error: `Ya existe otro proveedor llamado "${repetido.nombre}". Usa un nombre distinto.` };

  try {
    const anterior = await prisma.proveedor.findUniqueOrThrow({ where: { id } });
    const proveedor = await prisma.proveedor.update({
      where: { id },
      data: {
        codigo: String(datos.get("codigo") || "").trim() || anterior.codigo || (await siguienteCodigoProveedor()),
        nombre,
        rtn: String(datos.get("rtn") || "").trim() || null,
        contacto: String(datos.get("contacto") || "").trim() || null,
        telefono: String(datos.get("telefono") || "").trim() || null,
        correo: String(datos.get("correo") || "").trim() || null,
        direccion: String(datos.get("direccion") || "").trim() || null,
        tipoProducto: String(datos.get("tipoProducto") || "").trim() || null,
        activo: datos.get("activo") === "1",
      },
    });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Proveedores", accion: "Editó proveedor",
      detalle: `${proveedor.nombre} (${proveedor.codigo})`,
    });
  } catch (e) {
    return { error: mensajeSiEsDuplicado(e, { rtn: "RTN", codigo: "código" }) };
  }

  revalidatePath("/proveedores");
  redirect("/proveedores");
}

export async function eliminarProveedor(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("proveedores.gestionar");
  const id = Number(datos.get("id"));
  const usado = await prisma.material.count({ where: { proveedorId: id } });
  if (usado > 0) return { error: "No se puede eliminar: tiene materiales asociados." };

  const proveedor = await prisma.proveedor.delete({ where: { id } });
  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Proveedores", accion: "Eliminó proveedor", detalle: proveedor.nombre,
  });
  revalidatePath("/proveedores");
  return { error: null };
}

export async function crearMaterial(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("materiales.gestionar");
  const codigo = String(datos.get("codigo") || "").trim();
  const nombre = String(datos.get("nombre") || "").trim();
  const categoria = String(datos.get("categoria") || "").trim();
  const unidad = String(datos.get("unidad") || "").trim();
  const familia = String(datos.get("familia") || "").trim();
  const variante = String(datos.get("variante") || "").trim();
  if (!codigo || !nombre) return { error: "El código y el nombre son obligatorios." };
  if (!categoria) return { error: "La categoría es obligatoria." };
  if (!unidad) return { error: "La unidad de medida es obligatoria." };

  const existencia = enteroDelFormulario(datos.get("existencia"), 0);
  const minimo = enteroDelFormulario(datos.get("minimo"), 0);
  if (existencia === null) return { error: "La existencia debe ser un número igual o mayor a cero." };
  if (minimo === null) return { error: "El mínimo en bodega debe ser un número igual o mayor a cero." };

  const nombreRepetido = variante
    ? await prisma.material.findFirst({
        where: { nombre: { equals: nombre, mode: "insensitive" }, variante: { equals: variante, mode: "insensitive" } },
      })
    : await prisma.material.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" }, variante: null } });
  if (nombreRepetido) {
    return {
      error: `Ya existe "${nombreRepetido.nombre}"${nombreRepetido.variante ? " (" + nombreRepetido.variante + ")" : ""} con código ${nombreRepetido.codigo}. Usa otra variante o edita ese material.`,
    };
  }

  const adjunta = leerImagenAdjunta(datos);
  if (adjunta.error) return { error: adjunta.error };

  let imagenUrl: string | null = null;
  try {
    if (adjunta.archivo) imagenUrl = await subirImagenMaterial(adjunta.archivo);

    const material = await prisma.material.create({
      data: {
        codigo, nombre, categoria,
        // La unidad se guarda en forma canónica ("CAJA", no "CAJAS" ni "caja")
        // para que no vuelvan a aparecer unidades duplicadas en el catálogo.
        unidad: normalizarUnidad(unidad),
        familia: familia || null,
        variante: variante || null,
        existencia,
        minimo,
        proveedorId: Number(datos.get("proveedorId")) || null,
        imagenUrl,
      },
    });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Materiales", accion: "Registró material",
      detalle: `${material.codigo} — ${material.nombre}${imagenUrl ? " (con imagen)" : ""}`,
    });
  } catch (e) {
    await borrarImagenMaterial(imagenUrl);
    return { error: mensajeSiEsDuplicado(e, { codigo: "código" }) };
  }

  revalidatePath("/materiales");
  return { error: null };
}

export async function editarMaterial(id: number, _prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("materiales.gestionar");
  const codigo = String(datos.get("codigo") || "").trim();
  const nombre = String(datos.get("nombre") || "").trim();
  const categoria = String(datos.get("categoria") || "").trim();
  const unidad = String(datos.get("unidad") || "").trim();
  const familia = String(datos.get("familia") || "").trim();
  const variante = String(datos.get("variante") || "").trim();
  if (!codigo || !nombre) return { error: "El código y el nombre son obligatorios." };
  if (!categoria) return { error: "La categoría es obligatoria." };
  if (!unidad) return { error: "La unidad de medida es obligatoria." };

  const adjunta = leerImagenAdjunta(datos);
  if (adjunta.error) return { error: adjunta.error };

  const anterior = await prisma.material.findUniqueOrThrow({ where: { id } });
  const nuevaExistencia = enteroDelFormulario(datos.get("existencia"), anterior.existencia);
  const nuevoMinimo = enteroDelFormulario(datos.get("minimo"), anterior.minimo);
  if (nuevaExistencia === null) return { error: "La existencia debe ser un número igual o mayor a cero." };
  if (nuevoMinimo === null) return { error: "El mínimo en bodega debe ser un número igual o mayor a cero." };

  const quitarImagen = datos.get("quitarImagen") === "1";
  let imagenNueva: string | null = null;
  if (adjunta.archivo) {
    try {
      imagenNueva = await subirImagenMaterial(adjunta.archivo);
    } catch (e) {
      return { error: `No se pudo subir la imagen: ${e instanceof Error ? e.message : "error desconocido."}` };
    }
  }
  const imagenUrl = imagenNueva ?? (quitarImagen ? null : anterior.imagenUrl);
  const cambioDeImagen = imagenUrl !== anterior.imagenUrl;

  try {
    const material = await prisma.material.update({
      where: { id },
      data: {
        codigo, nombre, categoria,
        // Igual que al crear: la unidad se deja siempre en forma canónica.
        unidad: normalizarUnidad(unidad),
        familia: familia || null,
        variante: variante || null,
        existencia: nuevaExistencia,
        minimo: nuevoMinimo,
        proveedorId: Number(datos.get("proveedorId")) || null,
        imagenUrl,
      },
    });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Materiales", accion: "Editó material",
      detalle: `${material.codigo} — ${material.nombre}` +
        (anterior.existencia !== nuevaExistencia ? ` (existencia ${anterior.existencia} → ${nuevaExistencia})` : "") +
        (cambioDeImagen ? (imagenUrl ? " (cambio de imagen)" : " (se quitó la imagen)") : ""),
    });
    if (cambioDeImagen) await borrarImagenMaterial(anterior.imagenUrl);
  } catch (e) {
    await borrarImagenMaterial(imagenNueva);
    return { error: mensajeSiEsDuplicado(e, { codigo: "código" }) };
  }

  revalidatePath("/materiales");
  redirect("/materiales");
}

export async function eliminarMaterial(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("materiales.gestionar");
  const id = Number(datos.get("id"));
  const usado = await prisma.detalleOrden.count({ where: { materialId: id } });
  if (usado > 0) return { error: "No se puede eliminar: aparece en requisiciones ya registradas." };

  const material = await prisma.material.delete({ where: { id } });
  await borrarImagenMaterial(material.imagenUrl);
  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Materiales", accion: "Eliminó material",
    detalle: `${material.codigo} — ${material.nombre}`,
  });
  revalidatePath("/materiales");
  return { error: null };
}

/** Busca el proveedor de la requisición entre los elegidos en los renglones y,
 *  si ninguno lo trae, entre los proveedores que ya tiene asignados el catálogo.
 *  El proveedor es opcional: si no aparece ninguno se devuelve null y la
 *  requisición se guarda sin él. En la consolidación sale en un grupo aparte. */
async function resolverProveedorDeItems(
  items: { materialId: number; proveedorId: number | null }[],
): Promise<number | null> {
  const elegido = items.find((it) => it.proveedorId);
  if (elegido?.proveedorId) return elegido.proveedorId;

  const materiales = await prisma.material.findMany({
    where: { id: { in: items.map((it) => it.materialId) } },
    select: { id: true, proveedorId: true },
  });
  const porId = new Map(materiales.map((m) => [m.id, m]));
  const conProveedor = items.find((it) => porId.get(it.materialId)?.proveedorId);
  if (conProveedor) return porId.get(conProveedor.materialId)!.proveedorId!;

  return null;
}

// La lectura de los renglones (cantidad, programa y adjuntos por material)
// vive en items-requisicion.ts, junto con el manejo de los archivos. El
// borrador pasa `borrador: true` para que no se le exijan los datos que faltan.
function leerItems(datos: FormData, opciones: { borrador?: boolean } = {}) {
  return leerItemsDelFormulario(datos, opciones);
}

/** Arma el folio del año: OC-<año>-<número>, con el número siguiente al más
 *  alto que ya existe.
 *
 *  Antes se usaba el número de requisiciones del año + 1, que se equivoca en
 *  cuanto hay un hueco: si se borró una (0004, por ejemplo) quedan cuatro y el
 *  siguiente folio salía 0005, que ya existía, y el guardado reventaba con
 *  "folio duplicado". Borrar borradores deja huecos con frecuencia, así que se
 *  toma el máximo y no la cantidad. */
async function siguienteFolioOrden(): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `OC-${anio}-`;
  const ultimo = await prisma.ordenCompra.findFirst({
    where: { folio: { startsWith: prefijo } },
    orderBy: { folio: "desc" },
    select: { folio: true },
  });
  const mayor = ultimo ? Number(ultimo.folio.slice(prefijo.length)) : 0;
  return `${prefijo}${String((Number.isFinite(mayor) ? mayor : 0) + 1).padStart(4, "0")}`;
}

export async function crearOrden(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("ordenes.crear");
  // El mismo formulario sirve para dejar la requisición a medias y para
  // enviarla. El botón que se apretó lo dice el campo "intento".
  const esBorrador = datos.get("intento") === "borrador";
  const dependencia = String(datos.get("dependencia") || "").trim();
  const justificacion = String(datos.get("justificacion") || "").trim();
  const items = leerItems(datos, { borrador: esBorrador });

  // Un borrador se guarda con lo que haya: por eso estas revisiones solo
  // aplican cuando la requisición se envía de verdad.
  if (!esBorrador) {
    if (!dependencia) return { error: "La dependencia es obligatoria." };
    if (!items.length) return { error: "Agrega al menos un material con cantidad mayor a cero." };
    // El programa ahora es de cada renglón, así que se revisa material por
    // material en vez de una sola vez para toda la requisición.
    const sinPrograma = items.findIndex((it) => !it.programa);
    if (sinPrograma !== -1) {
      return { error: "Elige el programa del material de la fila " + (sinPrograma + 1) + "." };
    }
  }

  const proveedorId = await resolverProveedorDeItems(items);

  let ordenId: number;
  // Los adjuntos se suben antes de tocar la base: si la requisición no se
  // guarda, se deshacen las subidas para no dejar archivos huérfanos.
  const adjuntos = await resolverAdjuntos(items, new Map());
  try {
    const folio = await siguienteFolioOrden();

    const orden = await prisma.ordenCompra.create({
      data: {
        folio,
        // El borrador nace con folio propio para que el solicitante lo
        // distinga de una requisición enviada.
        estado: esBorrador ? "Borrador" : "Pendiente",
        proveedorId, dependencia: dependencia || null, justificacion,
        solicitanteId: Number(sesion.user.id),
        items: { create: adjuntos.items.map(datosRenglon) },
      },
    });
    ordenId = orden.id;

    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Requisiciones",
      accion: esBorrador ? "Guardó borrador" : "Creó requisición",
      detalle: `${orden.folio} (${items.length} material(es))`,
    });
  } catch (e) {
    await deshacerSubidas(adjuntos.subidos);
    console.error("crearOrden:", e);
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return { error: "No se pudo crear la requisición: " + msg };
  }

  revalidatePath("/ordenes");
  redirect(`/ordenes/${ordenId}`);
}

export async function editarOrden(id: number, _prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await sesionObligatoria();
  if (!puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes")) {
    return { error: "No tienes acceso al módulo de requisiciones." };
  }
  const puedeTodas = puede(sesion.user.rol, "ordenes.editarTodas");
  const puedeAprobadas = puede(sesion.user.rol, "ordenes.editarAprobadas");

  const orden = await prisma.ordenCompra.findUniqueOrThrow({ where: { id } });
  const esPropia = orden.solicitanteId === Number(sesion.user.id);
  const eraBorrador = orden.estado === "Borrador";

  if (orden.estado === "Recibida") {
    return { error: "Una requisición recibida ya no puede editarse." };
  }
  // Un borrador es trabajo en curso personal: solo quien lo empezó lo
  // continúa, aunque su rol pueda editar requisiciones ajenas.
  if (eraBorrador && !esPropia) {
    return { error: "Este borrador es de otro usuario: no puedes continuarlo." };
  }
  if (orden.estado === "Aprobada" && !puedeAprobadas) {
    return { error: "Solo el administrador o el sub administrador pueden editar una requisición aprobada." };
  }
  if (orden.estado !== "Aprobada" && !puedeTodas && !esPropia) {
    return { error: "Solo el solicitante o un rol con permiso de edición pueden editar esta requisición." };
  }
  const eraAprobada = orden.estado === "Aprobada";

  // Mientras siga siendo borrador se guarda aunque falten datos. Al enviarlo
  // pasa a "Pendiente" y entra a revisión como cualquier requisición nueva.
  const esBorrador = datos.get("intento") === "borrador";
  const dependencia = String(datos.get("dependencia") || "").trim();
  const justificacion = String(datos.get("justificacion") || "").trim();
  const items = leerItems(datos, { borrador: esBorrador });

  if (!esBorrador) {
    if (!dependencia) return { error: "La dependencia es obligatoria." };
    if (!items.length) return { error: "Agrega al menos un material con cantidad mayor a cero." };
    const sinPrograma = items.findIndex((it) => !it.programa);
    if (sinPrograma !== -1) {
      return { error: "Elige el programa del material de la fila " + (sinPrograma + 1) + "." };
    }
  }

  const proveedorId = await resolverProveedorDeItems(items);

  // Los adjuntos que ya tenía la requisición se leen antes de la transacción,
  // porque esta borra los renglones y los vuelve a crear: sin esto no se
  // sabría qué archivo conservar, reemplazar o borrar del storage.
  const renglonesPrevios = await prisma.detalleOrden.findMany({
    where: { ordenId: id },
    select: { adjuntoUrl: true, adjuntoNombre: true },
  });
  const adjuntosConocidos = new Map<string, string>();
  for (const r of renglonesPrevios) {
    if (r.adjuntoUrl) adjuntosConocidos.set(r.adjuntoUrl, r.adjuntoNombre || "adjunto");
  }

  const adjuntos = await resolverAdjuntos(items, adjuntosConocidos);
  try {
    await prisma.$transaction([
      prisma.detalleOrden.deleteMany({ where: { ordenId: id } }),
      ...adjuntos.items.map((it) =>
        prisma.detalleOrden.create({ data: { ordenId: id, ...datosRenglon(it) } })
      ),
      prisma.ordenCompra.update({
        where: { id },
        data: {
          proveedorId, dependencia, justificacion,
          ...(eraAprobada
            ? {}
            : // Una requisición que no estaba aprobada vuelve a quedar
              // pendiente de revisión, salvo que se esté guardando como
              // borrador: entonces se queda esperando en ese estado.
              { estado: esBorrador ? "Borrador" : "Pendiente",
                revisorId: null, fechaRevision: null, comentario: null }),
        },
      }),
    ]);
    // Ya está guardado: los adjuntos reemplazados o quitados se pueden borrar.
    await Promise.all(adjuntos.porBorrar.map((url) => borrarAdjunto(url)));
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Requisiciones",
      accion: esBorrador ? "Guardó borrador" : "Editó requisición",
      detalle: esBorrador
        ? `${orden.folio} — quedó en borrador (${items.length} material(es)).`
        : `${orden.folio} — se actualizaron los materiales y quedó ` +
          (eraAprobada ? "aprobada." : "pendiente de revisión."),
    });
  } catch {
    // La requisición no cambió, así que los archivos nuevos sobran.
    await deshacerSubidas(adjuntos.subidos);
    return { error: "No se pudo guardar la requisición. Verifica los datos e intenta de nuevo." };
  }

  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${id}`);
  // Al guardar el borrador se vuelve al formulario para seguir llenándolo; al
  // enviar la requisición ya se va a su página.
  redirect(esBorrador ? `/ordenes/${id}/editar` : `/ordenes/${id}`);
}

/** Borra un borrador. Solo aplica a los borradores: una requisición que ya se
 *  envió no se elimina, se rechaza. */
export async function eliminarBorrador(id: number) {
  const sesion = await sesionObligatoria();
  if (!puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes")) {
    throw new Error("No tienes acceso al módulo de requisiciones.");
  }

  const orden = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id },
    include: { items: { select: { adjuntoUrl: true } } },
  });
  if (orden.estado !== "Borrador") {
    throw new Error("Solo se puede borrar una requisición que sigue en borrador.");
  }
  const esPropia = orden.solicitanteId === Number(sesion.user.id);
  if (!esPropia && !puede(sesion.user.rol, "ordenes.editarTodas")) {
    throw new Error("Solo quien creó el borrador o un administrador pueden borrarlo.");
  }

  // Los renglones se van en cascada con la orden; los adjuntos que el
  // solicitante subió a Supabase hay que borrarlos aparte.
  await prisma.ordenCompra.delete({ where: { id } });
  await Promise.all(orden.items.map((it) => it.adjuntoUrl).filter(Boolean).map(borrarAdjunto));

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Requisiciones",
    accion: "Borró borrador", detalle: `${orden.folio}`,
  });
  revalidatePath("/ordenes");
}

export async function resolverOrden(id: number, nuevoEstado: "Aprobada" | "Rechazada", comentario: string) {
  const sesion = await exigirPermiso("ordenes.autorizar");
  const actual = await prisma.ordenCompra.findUniqueOrThrow({ where: { id } });
  if (actual.estado !== "Pendiente") {
    throw new Error("Esta requisición ya fue revisada (aprobada o rechazada).");
  }

  const orden = await prisma.ordenCompra.update({
    where: { id },
    data: { estado: nuevoEstado, revisorId: Number(sesion.user.id), fechaRevision: new Date(), comentario },
  });

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Requisiciones",
    accion: nuevoEstado === "Aprobada" ? "Aprobó requisición" : "Rechazó requisición",
    detalle: `${orden.folio}${comentario ? " — " + comentario : ""}`,
  });
  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${id}`);
}

export async function recibirOrden(id: number) {
  const sesion = await exigirPermiso("ordenes.recibir");
  const orden = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  });
  if (orden.estado !== "Aprobada") {
    throw new Error("Solo se puede marcar como recibida una requisición aprobada.");
  }

  await prisma.$transaction([
    ...orden.items.map((it) =>
      prisma.material.update({
        where: { id: it.materialId },
        data: { existencia: { increment: it.cantidad } },
      })
    ),
    prisma.ordenCompra.update({
      where: { id },
      data: { estado: "Recibida", fechaRecepcion: new Date(), recibidoPorId: Number(sesion.user.id) },
    }),
  ]);

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Inventario", accion: "Recibió materiales",
    detalle: `${orden.folio} — se sumaron ${orden.items.length} material(es) a la existencia`,
  });
  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/materiales");
  revalidatePath("/");
}

function modulosDelFormulario(datos: FormData, rol: ReturnType<typeof rolValido>): string[] {
  if (rol === "administrador") return [MODULOS_DEL_ROL];

  const elegidos = new Set(datos.getAll("modulos").map((valor) => String(valor)));
  const modulos = MODULOS_POR_ROL[rol].filter((modulo) => modulo === "panel" || elegidos.has(modulo));
  return modulos.includes("panel") ? modulos : ["panel", ...modulos];
}

export async function crearUsuario(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("usuarios.gestionar");
  const nombre = String(datos.get("nombre") || "").trim();
  const usuario = String(datos.get("usuario") || "").trim().toLowerCase();
  const clave = String(datos.get("clave") || "");
  const rol = rolValido(datos.get("rol"));
  const modulosPermitidos = modulosDelFormulario(datos, rol);

  if (!nombre || !usuario) return { error: "El nombre y la cuenta son obligatorios." };
  if (clave.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };

  try {
    const claveHash = await bcrypt.hash(clave, 10);
    await prisma.usuario.create({ data: { nombre, usuario, claveHash, rol, modulosPermitidos } });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Usuarios", accion: "Creó usuario",
      detalle: `${nombre} (${usuario}) con rol ${rol} — módulos: ${modulosPermitidos.join(", ") || "ninguno"}`,
    });
  } catch (e) {
    return { error: mensajeSiEsDuplicado(e, { usuario: "nombre de cuenta" }) };
  }

  revalidatePath("/usuarios");
  return { error: null };
}

export async function editarUsuario(id: number, _prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("usuarios.gestionar");
  const nombre = String(datos.get("nombre") || "").trim();
  const rol = rolValido(datos.get("rol"));
  const modulosPermitidos = modulosDelFormulario(datos, rol);
  const clave = String(datos.get("clave") || "");
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (clave && clave.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };

  try {
    const anterior = await prisma.usuario.findUniqueOrThrow({ where: { id } });
    const data: {
      nombre: string;
      rol: typeof rol;
      modulosPermitidos: string[];
      claveHash?: string;
      sesionToken?: null;
      sesionExpira?: null;
    } = {
      nombre,
      rol,
      modulosPermitidos,
    };
    if (clave) {
      data.claveHash = await bcrypt.hash(clave, 10);
      data.sesionToken = null;
      data.sesionExpira = null;
    }

    await prisma.usuario.update({ where: { id }, data });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Usuarios", accion: "Editó usuario",
      detalle: nombre + (anterior.rol !== rol ? ` (rol ${anterior.rol} → ${rol})` : "") +
        ` — módulos: ${modulosPermitidos.join(", ") || "ninguno"}` +
        (clave ? " — se cambió la contraseña" : ""),
    });
  } catch (e) {
    return { error: mensajeSiEsDuplicado(e, { usuario: "nombre de cuenta" }) };
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function alternarUsuario(id: number) {
  const sesion = await exigirPermiso("usuarios.gestionar");
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id } });
  const actualizado = await prisma.usuario.update({
    where: { id },
    data: {
      activo: !usuario.activo,
      sesionToken: null,
      sesionExpira: null,
    },
  });

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Usuarios",
    accion: actualizado.activo ? "Activó usuario" : "Desactivó usuario",
    detalle: `${actualizado.nombre} (${actualizado.usuario})`,
  });
  revalidatePath("/usuarios");
}

export async function descargarInventario(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("inventario.descargar");

  const materialId = Number(datos.get("materialId"));
  const cantidad = Number(datos.get("cantidad"));
  const motivo = String(datos.get("motivo") || "").trim();

  if (!materialId) return { error: "Elige el material que vas a descargar." };
  if (!Number.isInteger(cantidad) || cantidad <= 0) return { error: "La cantidad debe ser un número entero mayor a cero." };
  if (!motivo) return { error: "Indica el motivo o destino del descargo." };

  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material || !material.activo) return { error: "Ese material no existe o está desactivado." };
  if (material.existencia < cantidad) {
    return { error: `Existencia insuficiente: hay ${material.existencia} ${material.unidad.toLowerCase()} de "${material.nombre}".` };
  }

  const existenciaAntes = material.existencia;
  const existenciaDespues = existenciaAntes - cantidad;

  await prisma.$transaction([
    prisma.material.update({ where: { id: materialId }, data: { existencia: existenciaDespues } }),
    prisma.descargoInventario.create({
      data: {
        materialId,
        usuarioId: Number(sesion.user.id),
        cantidad,
        motivo,
        existenciaAntes,
        existenciaDespues,
      },
    }),
  ]);

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id),
    modulo: "Inventario",
    accion: "Descargó inventario",
    detalle: `${material.codigo} — ${material.nombre}: -${cantidad} ${material.unidad.toLowerCase()} (existencia ${existenciaAntes} → ${existenciaDespues}). Motivo: ${motivo}`,
  });

  revalidatePath("/inventario");
  revalidatePath("/materiales");
  revalidatePath("/");
  return { error: null };
}
