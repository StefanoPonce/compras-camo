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
  inventarioPropio,
  type Permiso,
} from "@/lib/permisos";
import { materialesSolicitadosPor } from "@/lib/materiales-solicitados";
import { esDependenciaValida, normalizarDependencia, textoDependencia } from "@/lib/dependencias";
import { errorDeAutorizacion } from "@/lib/alcance-area";
import { leerImagenAdjunta, subirImagenMaterial, borrarImagenMaterial } from "@/lib/imagenes";
import { borrarAdjunto } from "@/lib/adjuntos";
import { normalizarUnidad } from "@/lib/unidades";
import {
  esEstadoGestion,
  ETIQUETAS_GESTION,
  type EstadoGestion,
} from "@/lib/estado-gestion";
import {
  datosRenglon,
  deshacerSubidas,
  leerItems as leerItemsDelFormulario,
  resolverAdjuntos,
} from "@/lib/items-requisicion";

export type EstadoForm = { error: string | null; exito?: string | null };

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

/** Exige al menos uno de varios permisos (cada uno con su módulo). Sirve para
 *  las acciones que viven en más de un módulo: los estados de compra se
 *  editan igual desde Gestión y desde Compras, y un usuario puede tener
 *  visible solo uno de los dos. */
async function exigirAlgunPermiso(permisos: Permiso[]) {
  const sesion = await sesionObligatoria();
  const delRol = permisos.filter((permiso) => puede(sesion.user.rol, permiso));
  if (!delRol.length) throw new Error("Tu rol no tiene permiso para esta acción.");

  const visible = delRol.some((permiso) => {
    const modulo = MODULO_DE_PERMISO[permiso];
    return !modulo || puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, modulo);
  });
  if (!visible) throw new Error("No tienes acceso al módulo requerido para esta acción.");

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
        cuentaBancaria: String(datos.get("cuentaBancaria") || "").trim() || null,
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
        cuentaBancaria: String(datos.get("cuentaBancaria") || "").trim() || null,
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
  if (!codigo || !nombre) return { error: "El código y el nombre son obligatorios." };
  if (!categoria) return { error: "La categoría es obligatoria." };
  if (!unidad) return { error: "La unidad de medida es obligatoria." };

  const existencia = enteroDelFormulario(datos.get("existencia"), 0);
  const minimo = enteroDelFormulario(datos.get("minimo"), 0);
  if (existencia === null) return { error: "La existencia debe ser un número igual o mayor a cero." };
  if (minimo === null) return { error: "El mínimo en bodega debe ser un número igual o mayor a cero." };

  // Lo que separa dos materiales es el nombre junto con la unidad: el Excel
  // trae parejas legítimas con el mismo nombre en unidades distintas
  // (GEL DESINFECTANTE en BOTE y en GALÓN), así que solo con el nombre
  // aparecerían como repetidos.
  const unidadCanonica = normalizarUnidad(unidad);
  const nombreRepetido = await prisma.material.findFirst({
    where: {
      nombre: { equals: nombre, mode: "insensitive" },
      unidad: { equals: unidadCanonica, mode: "insensitive" },
    },
  });
  if (nombreRepetido) {
    return {
      error: `Ya existe "${nombreRepetido.nombre}" (${nombreRepetido.unidad}) con código ${nombreRepetido.codigo}. Edítalo o ponle otro nombre o unidad.`,
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
        unidad: unidadCanonica,
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
  // La dependencia la manda la cuenta del solicitante: si tiene gerencia
  // asignada, la requisición nace SIEMPRE en esa área y el valor del
  // formulario se ignora. Solo quien no tiene área (por ejemplo el
  // administrador) elige en el desplegable.
  const dependenciaPropia = normalizarDependencia(sesion.user.area);
  const dependencia = dependenciaPropia || normalizarDependencia(datos.get("dependencia"));
  const area = String(datos.get("area") || "").trim();
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
        proveedorId, dependencia: dependencia || null, area: area || null, justificacion,
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
  // La edición NO es un permiso del rol: es un derecho de QUIEN LA SOLICITÓ.
  // Ni el jefe inmediato, ni la administración, ni ningún otro rol la corrige;
  // si hace falta un cambio se le pide al solicitante.
  const orden = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id },
    include: { solicitante: { select: { area: true, nombre: true } } },
  });
  const esPropia = orden.solicitanteId === Number(sesion.user.id);

  if (!esPropia) {
    return {
      error:
        "Solo quien solicitó esta requisición puede editarla. " +
        `Pídele a ${orden.solicitante.nombre || "el solicitante"} que haga el cambio.`,
    };
  }
  // Y solo mientras el estado la deja corregir: Borrador, Pendiente o
  // Rechazada. Una aprobada o recibida ya no se toca desde el sistema.
  if (orden.estado !== "Borrador" && orden.estado !== "Pendiente" && orden.estado !== "Rechazada") {
    return { error: `Una requisición en estado "${orden.estado}" ya no puede editarse.` };
  }

  // Mientras siga siendo borrador se guarda aunque falten datos. Al enviarlo
  // pasa a "Pendiente" y entra a revisión como cualquier requisición nueva.
  const esBorrador = datos.get("intento") === "borrador";
  const dependenciaPropia = normalizarDependencia(orden.solicitante.area);
  const dependencia = dependenciaPropia || normalizarDependencia(datos.get("dependencia"));
  const area = String(datos.get("area") || "").trim();
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
        // El estado se vuelve a comprobar dentro de la transacción: si entre
        // la lectura y este punto pasó a aprobada o recibida, no se guarda nada.
        where: { id, estado: { in: ["Borrador", "Pendiente", "Rechazada"] } },
        data: {
          proveedorId, dependencia, area: area || null, justificacion,
          // Al corregirla vuelve a quedar pendiente de revisión, salvo que se
          // esté guardando como borrador: entonces se queda en ese estado.
          estado: esBorrador ? "Borrador" : "Pendiente",
          revisorId: null, fechaRevision: null, comentario: null,
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
          "pendiente de revisión.",
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
  // Como con la edición: el borrador es trabajo personal en curso, solo lo
  // borra quien lo empezó (ni el jefe de área, ni la administración).
  if (!esPropia) {
    throw new Error("Solo quien creó este borrador puede borrarlo.");
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

/** Autoriza o rechaza una requisición pendiente.
 *
 *  Además del permiso "ordenes.autorizar", el jefe inmediato solo puede
 *  hacerlo con las requisiciones de SU gerencia (ver src/lib/alcance-area.ts):
 *  si no es de su área —o si su cuenta todavía no tiene área— se devuelve el
 *  motivo en `error` y no se toca la requisición. Administrador y sub
 *  administrador autorizan cualquier área, porque son el respaldo.
 *
 *  Devuelve `{ error }` en vez de lanzar la excepción para que el motivo llegue
 *  completo al navegador: los errores lanzados dentro de una server action no
 *  se muestran en producción. */
export async function resolverOrden(
  id: number,
  nuevoEstado: "Aprobada" | "Rechazada",
  comentario: string,
): Promise<{ error?: string }> {
  const sesion = await exigirPermiso("ordenes.autorizar");
  const actual = await prisma.ordenCompra.findUniqueOrThrow({ where: { id } });

  const motivoArea = errorDeAutorizacion(sesion.user, actual);
  if (motivoArea) return { error: motivoArea };

  if (actual.estado !== "Pendiente") {
    return { error: "Esta requisición ya fue revisada (aprobada o rechazada)." };
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
  return {};
}

// La requisición ya NO se cierra sola en "Recibida" cuando se resuelven todos
// sus renglones: se queda "Aprobada". Lo que se muestra en pantalla
// ("Pendiente a recibir" mientras falte confirmación y "Recibido" cuando el
// solicitante confirma todos sus productos) se calcula con estadoVisibleDe()
// de src/lib/estado-gestion.ts. La recepción formal con la suma a la
// existencia sigue siendo de "Registrar entrega" (recibirOrden, más abajo).

/** Cambia el estado de compra de una fila de la consolidación: recibe los
 *  ids de los renglones (detalle_orden) que forman la fila y les pone el
 *  estado nuevo, con el contador que le corresponde (Gestionado →
 *  cantidadGestionada, Entregado → cantidadComprada, Pendiente → ninguno de
 *  los dos). "Entregado" sigue exigiendo Compras.
 *
 *  Cuando con esto ya no queda ningún renglón Pendiente en una requisición,
 *  esa requisición se queda Aprobada (ya no se cierra sola): en pantalla pasa
 *  a verse "Pendiente a recibir" y a "Recibido" cuando el solicitante
 *  confirma todos sus productos (estadoVisibleDe). No toca el inventario: la
 *  recepción formal (nombre de quien recibe y suma a la existencia) la sigue
 *  registrando el sub administrador desde la requisición.
 *
 *  NOTA: hoy ninguna columna de la consolidación llama a esta acción: la
 *  ventana "Ver requisiciones" usa actualizarConteoRenglon(), que mueve UN
 *  renglón (una requisición, un solicitante) y puede dejarlo a la mitad.
 *  Esta sigue siendo la forma de mover TODA la fila de una vez; si ya no se
 *  quiere ofrecer, se puede eliminar junto con su llamada. */
export async function actualizarEstadoGestion(
  lineaIds: number[],
  nuevoEstado: EstadoGestion,
): Promise<{ error?: string }> {
  const sesion = await exigirAlgunPermiso(
    nuevoEstado === "Entregado" ? ["compras.editar"] : ["consolidacion.editar", "compras.editar"],
  );

  if (!esEstadoGestion(nuevoEstado)) return { error: "Ese estado no existe." };
  if (!Array.isArray(lineaIds) || !lineaIds.length || !lineaIds.every((id) => Number.isInteger(id))) {
    return { error: "No se pudieron identificar los renglones a actualizar." };
  }

  const lineas = await prisma.detalleOrden.findMany({
    where: { id: { in: lineaIds } },
    include: {
      orden: { select: { id: true, folio: true, estado: true } },
      material: { select: { nombre: true } },
    },
  });
  if (!lineas.length) return { error: "Esos renglones ya no existen." };

  // Solo se gestiona lo que sigue aprobado: una requisición rechazada no pasa
  // por Gestión y una cerrada ya no vuelve atrás. Además, un renglón que YA
  // entró al inventario no se puede volver a dejar "Pendiente de Compra": ya
  // está en bodega y eso dejaría la requisición sin poder cerrarse.
  const editables = lineas.filter(
    (l) => l.orden.estado === "Aprobada" && !(l.inventariado && nuevoEstado === "Pendiente"),
  );
  if (!editables.length) {
    const yaContado = nuevoEstado === "Pendiente" && lineas.some((l) => l.inventariado);
    return {
      error: yaContado
        ? "Ese material ya entró al inventario: su estado ya no se puede dejar como Pendiente de Compra."
        : "Solo se puede cambiar el estado de los materiales de requisiciones aprobadas.",
    };
  }

  const ordenIds = [...new Set(editables.map((l) => l.orden.id))];
  const folios = [...new Set(editables.map((l) => l.orden.folio))];
  const materiales = [...new Set(editables.map((l) => l.material.nombre))];

  await prisma.$transaction(async (tx) => {
    // Se guarda junto el contador que le toca al estado. Gestionado y
    // Entregado viven en columnas aparte (cantidadGestionada y
    // cantidadComprada) para que lo que hace un módulo no borre lo que hizo
    // el otro: así el desglose de "Cantidad consolidada" siempre suma lo
    // mismo que la fila.
    for (const l of editables) {
      await tx.detalleOrden.update({
        where: { id: l.id },
        data: {
          estadoGestion: nuevoEstado,
          cantidadGestionada: nuevoEstado === "Gestionado" ? l.cantidad : 0,
          cantidadComprada: nuevoEstado === "Entregado" ? l.cantidad : 0,
        },
      });
    }
  });

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id),
    modulo: nuevoEstado === "Entregado" ? "Compras" : "Gestión",
    accion: `Marcó material como ${ETIQUETAS_GESTION[nuevoEstado]}`,
    detalle: `${folios.join(", ")} — ${materiales.join(", ")}`,
  });

  revalidatePath("/gestion");
  revalidatePath("/compras");
  revalidatePath("/ordenes");
  for (const ordenId of ordenIds) revalidatePath(`/ordenes/${ordenId}`);
  return {};
}

/** Guarda cuántas unidades de UN SOLO renglón lleva este contador. Un renglón
 *  es una requisición pidiendo un material, o sea UN solicitante: es el
 *  control por persona que ofrece la ventana "Ver requisiciones".
 *
 *  Aquí manda el encargado, no el sistema: si dos personas pidieron el mismo
 *  material y solo se gestionó el de una, se guarda 1 en el renglón de Erick
 *  y 0 en el de Luis, y el de Luis queda sin resolver y sigue en proceso,
 *  tal como se decidió.
 *
 *  Por eso acá además se puede BAJAR un valor (de 1 a 0), algo que un reparto
 *  automático de la fila no permite, y por eso las reglas se revisan UNA vez
 *  sobre el renglón en cuestión en vez de repartir: un error apunta a la
 *  requisición exacta en vez de avisar que "parte de la fila" no se pudo
 *  mover.
 *
 *  Límites: solo requisiciones aprobadas, nada que ya esté en inventario, y
 *  el contador nunca pasa de lo que falta por resolver restando al otro
 *  contador. */
export async function actualizarConteoRenglon(
  campo: "gestionada" | "comprada",
  lineaId: number,
  cantidad: number,
): Promise<{ error?: string; aplicadas?: number }> {
  const sesion = await exigirAlgunPermiso(
    campo === "comprada" ? ["compras.editar"] : ["consolidacion.editar", "compras.editar"],
  );

  if (!Number.isInteger(cantidad) || cantidad < 0) {
    return {
      error: campo === "comprada" ? "La cantidad comprada no es válida." : "La cantidad gestionada no es válida.",
    };
  }
  if (!Number.isInteger(lineaId)) {
    return { error: "No se pudo identificar el renglón a actualizar." };
  }

  const linea = await prisma.detalleOrden.findUnique({
    where: { id: lineaId },
    include: {
      orden: { select: { id: true, folio: true, estado: true } },
      material: { select: { nombre: true } },
    },
  });
  if (!linea) return { error: "Ese renglón ya no existe." };

  if (linea.orden.estado !== "Aprobada") {
    return { error: `Solo se puede registrar en los materiales de requisiciones aprobadas (${linea.orden.folio}).` };
  }
  if (linea.inventariado) {
    return { error: `${linea.material.nombre} de ${linea.orden.folio} ya está en inventario: no se puede modificar.` };
  }

  const gestionadas = Math.min(Math.max(linea.cantidadGestionada || 0, 0), linea.cantidad);
  const compradas = Math.min(Math.max(linea.cantidadComprada || 0, 0), linea.cantidad - gestionadas);
  // Hasta cuánto admite ESTE contador en este renglón: lo que no resolvió el
  // otro. Lo gestionado no se puede comprar otra vez ni lo comprado gestionar
  // otra vez, y el valor pedido se recorta a ese tope.
  const tope = campo === "comprada" ? linea.cantidad - gestionadas : linea.cantidad - compradas;
  const nuevas = Math.min(Math.max(cantidad, 0), tope);

  const gestionadasFinales = campo === "gestionada" ? nuevas : gestionadas;
  const compradasFinales = campo === "comprada" ? nuevas : compradas;
  const completa = gestionadasFinales + compradasFinales >= linea.cantidad;

  await prisma.detalleOrden.update({
    where: { id: linea.id },
    data: {
      cantidadGestionada: gestionadasFinales,
      cantidadComprada: compradasFinales,
      // El estado es el RESUMEN de los dos contadores: mientras quede algo
      // por resolver sigue Pendiente, aunque ya tenga unidades gestionadas o
      // compradas. Resuelto, queda Entregado si se compró algo y Gestionado
      // si se resolvió solo con Gestión. Eso mantiene en pie las reglas de
      // inventario, que se apoyan en el estado.
      estadoGestion: completa ? (compradasFinales > 0 ? "Entregado" : "Gestionado") : "Pendiente",
    },
  });

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id),
    modulo: campo === "comprada" ? "Compras" : "Gestión",
    accion: `Registró ${nuevas} unidad(es) ${campo === "comprada" ? "comprada(s)" : "gestionada(s)"}`,
    detalle: `${linea.orden.folio} — ${linea.material.nombre}`,
  });

  revalidatePath("/gestion");
  revalidatePath("/compras");
  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${linea.orden.id}`);

  // Lo que quedó guardado, que puede ser menos de lo pedido si se pasó del
  // tope: el cliente avisa en vez de dejar el campo diciendo algo que no quedó.
  return { aplicadas: nuevas };
}

/** El solicitante confirma, producto por producto, que ya le llegó el material.
 *
 *  Es una marca por renglón: NO suma al inventario ni cambia el estado
 *  guardado de la requisición (la recepción formal la sigue registrando el
 *  sub administrador con "Registrar entrega"), pero de ella sale la etiqueta
 *  que se muestra en pantalla: "Pendiente a recibir" mientras falte alguna
 *  confirmación y "Recibido" cuando la tengan todos los renglones
 *  (estadoVisibleDe, en src/lib/estado-gestion.ts). Puede marcarlo únicamente
 *  el solicitante de ESA requisición, cuando ya esté aprobada o recibida (no
 *  se recibe algo que todavía no se ha autorizado) Y cuando el producto ya
 *  esté gestionado o comprado: un renglón todavía "Pendiente" no ofrece el
 *  botón. */
export async function confirmarReciboProducto(
  lineaId: number,
  confirmado: boolean,
): Promise<{ error?: string }> {
  const sesion = await sesionObligatoria();

  if (!Number.isInteger(lineaId)) return { error: "No se pudo identificar el producto." };
  if (typeof confirmado !== "boolean") return { error: "Marca no válida." };

  const linea = await prisma.detalleOrden.findUnique({
    where: { id: lineaId },
    include: {
      orden: { select: { id: true, folio: true, estado: true, solicitanteId: true } },
      material: { select: { nombre: true } },
    },
  });
  if (!linea) return { error: "Ese producto ya no existe en la requisición." };

  if (linea.orden.solicitanteId !== Number(sesion.user.id)) {
    return { error: "Solo el solicitante de esta requisición puede confirmar la recepción de sus productos." };
  }

  const estado = linea.orden.estado;
  if (estado !== "Aprobada" && estado !== "Recibida") {
    return {
      error:
        estado === "Rechazada"
          ? "Esta requisición fue rechazada: no se puede confirmar la recepción."
          : "Este producto se puede marcar como recibido cuando la requisición esté aprobada.",
    };
  }

  // El producto debe estar resuelto (Gestionado o ENTREGADO) antes de que el
  // solicitante confirme que le llegó: mientras siga "Pendiente" todavía ni se
  // gestionó ni se compró, así que no hay nada que recibir. Deshacer una marca
  // vieja sí se permite sin importar el estado.
  if (confirmado && linea.estadoGestion === "Pendiente") {
    return {
      error:
        "Este producto todavía no está gestionado ni comprado: se puede marcar como recibido cuando esté resuelto.",
    };
  }

  await prisma.detalleOrden.update({
    where: { id: linea.id },
    data: confirmado
      ? { recibidoSolicitante: true, recibidoSolicitanteEn: new Date() }
      : { recibidoSolicitante: false, recibidoSolicitanteEn: null },
  });

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id),
    modulo: "Requisiciones",
    accion: confirmado ? "Marcó producto como recibido" : "Dejó de marcar un producto como recibido",
    detalle: `${linea.orden.folio} — ${linea.material.nombre}`,
  });

  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${linea.orden.id}`);
  return {};
}

/** Registra la entrega de una requisición aprobada. Solo la recibe el sub
 *  administrador (único rol con "ordenes.recibir") y escribe el nombre de la
 *  persona que tomó el material: no siempre tiene cuenta en el sistema, así
 *  que se guarda como texto y es lo que aparece impreso en la hoja.
 *
 *  También sirve para registrar una entrega parcial: mientras quede material
 *  "Pendiente de Compra" la requisición se queda Aprobada (así se registra el
 *  resto más tarde) y solo pasa a Recibida cuando ya no falta nada. */
export async function recibirOrden(id: number, recibioTxt: string) {
  const sesion = await exigirPermiso("ordenes.recibir");
  const nombre = String(recibioTxt || "").trim();
  if (!nombre) {
    throw new Error("Escribe el nombre de quien recibió la entrega.");
  }

  const orden = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id },
    include: { items: true },
  });
  // Aprobada: entrega normal (total o parcial). Recibida: los productos se
  // resolvieron desde Gestión/Compras y todavía puede faltar contarlos.
  if (orden.estado !== "Aprobada" && orden.estado !== "Recibida") {
    throw new Error("Solo se puede registrar la entrega de una requisición aprobada.");
  }

  // Solo entra a la existencia lo que ya se resolvió —Gestionado o
  // ENTREGADO— y todavía no se había contado. Lo que sigue "Pendiente de
  // Compra" no ha llegado, y lo ya contado no se suma dos veces: así se
  // puede registrar la entrega por partes.
  const porContar = orden.items.filter((it) => it.estadoGestion !== "Pendiente" && !it.inventariado);
  if (!porContar.length) {
    throw new Error(
      "No hay productos que sumar al inventario: lo que sigue pendiente de compra todavía no ha llegado.",
    );
  }

  // La requisición se cierra cuando ya no queda ningún renglón pendiente de
  // compra. Mientras falte uno, se queda Aprobada para poder registrar el
  // resto más tarde (y para que lo pendiente siga visible en Compras).
  const quedanPendientes = orden.items.some((it) => it.estadoGestion === "Pendiente");

  await prisma.$transaction([
    ...porContar.map((it) =>
      prisma.material.update({
        where: { id: it.materialId },
        data: { existencia: { increment: it.cantidad } },
      })
    ),
    prisma.detalleOrden.updateMany({
      where: { id: { in: porContar.map((it) => it.id) } },
      data: { inventariado: true, inventariadoEn: new Date() },
    }),
    prisma.ordenCompra.update({
      where: { id },
      data: {
        // Una entrega parcial no cierra la requisición.
        estado: quedanPendientes ? orden.estado : "Recibida",
        // La fecha se pone al cerrar: si aún falta material, todavía no es la
        // recepción completa (lo parcial queda en la bitácora).
        fechaRecepcion: quedanPendientes ? orden.fechaRecepcion : (orden.fechaRecepcion ?? new Date()),
        recibidoPorId: Number(sesion.user.id),
        recibidoPorTxt: nombre,
      },
    }),
  ]);

  const pendientes = orden.items.filter((it) => it.estadoGestion === "Pendiente").length;
  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Inventario", accion: "Recibió materiales",
    detalle:
      `${orden.folio} — recibió ${nombre} — se sumaron ${porContar.length} material(es) a la existencia` +
      (pendientes ? ` — quedan ${pendientes} pendiente(s) de compra sin contar` : ""),
  });
  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/materiales");
  revalidatePath("/gestion");
  revalidatePath("/compras");
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
  // Gerencia a la que pertenece la persona (catálogo de dependencias). De ahí
  // salen las requisiciones que verá y, si es jefe inmediato, las que puede
  // autorizar.
  const area = normalizarDependencia(datos.get("area"));

  if (!nombre || !usuario) return { error: "El nombre y la cuenta son obligatorios." };
  if (clave.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };
  if (!esDependenciaValida(area)) {
    return { error: "El área (gerencia) debe ser una del catálogo. Elige una de la lista o déjala vacía." };
  }
  if (rol === "jefe_inmediato" && !area) {
    return {
      error:
        "Un jefe inmediato necesita un área asignada: elige la gerencia que va a dirigir " +
        "(sin ella no verá ni podrá autorizar las requisiciones de esa área).",
    };
  }

  // Reviso antes de insertar para poder decirle cuál cuenta ya está ocupada
  // (el error de la base no trae el valor y suena muy genérico).
  const existente = await prisma.usuario.findUnique({ where: { usuario }, select: { activo: true } });
  if (existente) {
    return {
      error:
        `Ya existe un usuario con la cuenta "${usuario}"` +
        (existente.activo ? "" : " (está desactivado)") +
        `. Puede haberse creado en un intento anterior: revísalo en la lista de abajo o usa otra cuenta.`,
    };
  }

  try {
    const claveHash = await bcrypt.hash(clave, 10);
    await prisma.usuario.create({
      data: { nombre, usuario, claveHash, rol, modulosPermitidos, area: area || null },
    });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Usuarios", accion: "Creó usuario",
      detalle:
        `${nombre} (${usuario}) con rol ${rol}` +
        (area ? ` — área: ${textoDependencia(area)}` : " — sin área asignada") +
        ` — módulos: ${modulosPermitidos.join(", ") || "ninguno"}`,
    });
  } catch (e) {
    return { error: mensajeSiEsDuplicado(e, { usuario: "nombre de cuenta" }) };
  }

  revalidatePath("/usuarios");
  return { error: null, exito: `Usuario creado correctamente: ${nombre} (cuenta "${usuario}").` };
}

export async function editarUsuario(id: number, _prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("usuarios.gestionar");
  const nombre = String(datos.get("nombre") || "").trim();
  const usuario = String(datos.get("usuario") || "").trim().toLowerCase();
  const rol = rolValido(datos.get("rol"));
  const modulosPermitidos = modulosDelFormulario(datos, rol);
  const clave = String(datos.get("clave") || "");
  // Cambiar de área lo hace el administrador desde aquí: es el único sitio
  // donde se asigna la gerencia de una cuenta.
  const area = normalizarDependencia(datos.get("area"));
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (!usuario) return { error: "La cuenta de acceso es obligatoria." };
  if (clave && clave.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };
  if (!esDependenciaValida(area)) {
    return { error: "El área (gerencia) debe ser una del catálogo. Elige una de la lista o déjala vacía." };
  }
  if (rol === "jefe_inmediato" && !area) {
    return {
      error:
        "Un jefe inmediato necesita un área asignada: elige la gerencia que va a dirigir " +
        "(sin ella no verá ni podrá autorizar las requisiciones de esa área).",
    };
  }

  try {
    const anterior = await prisma.usuario.findUniqueOrThrow({ where: { id } });
    const data: {
      nombre: string;
      usuario?: string;
      rol: typeof rol;
      area: string | null;
      modulosPermitidos: string[];
      claveHash?: string;
      sesionToken?: null;
      sesionExpira?: null;
    } = {
      nombre,
      rol,
      area: area || null,
      modulosPermitidos,
    };
    // La cuenta de acceso se puede corregir. Si se deja igual, no se toca.
    if (usuario !== anterior.usuario) data.usuario = usuario;
    if (clave) {
      data.claveHash = await bcrypt.hash(clave, 10);
      data.sesionToken = null;
      data.sesionExpira = null;
    }

    await prisma.usuario.update({ where: { id }, data });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Usuarios", accion: "Editó usuario",
      detalle: nombre +
        (anterior.usuario !== usuario ? ` (cuenta ${anterior.usuario} → ${usuario})` : "") +
        (anterior.rol !== rol ? ` (rol ${anterior.rol} → ${rol})` : "") +
        (normalizarDependencia(anterior.area) !== area
          ? ` (área ${normalizarDependencia(anterior.area) ? textoDependencia(anterior.area) : "sin área"}` +
            ` → ${area ? textoDependencia(area) : "sin área"})`
          : "") +
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

/** Borra la cuenta del usuario. La base de datos no deja borrar a quien ya
 *  tiene requisiciones o descargos (restricción de clave foránea), así que
 *  eso se avisa antes en vez de reventar; en esos casos conviene desactivar
 *  la cuenta. Tampoco se borra la propia ni al último administrador activo,
 *  para no dejar el sistema sin quien pueda administrarlo. */
export async function eliminarUsuario(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("usuarios.gestionar");
  const id = Number(datos.get("id"));
  const propio = Number(sesion.user.id);

  if (!Number.isInteger(id) || id <= 0) return { error: "Usuario no válido." };
  if (id === propio) return { error: "No puedes eliminar tu propia cuenta." };

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) return { error: "Ese usuario ya no existe." };

  if (usuario.rol === "administrador") {
    const otrosAdmins = await prisma.usuario.count({
      where: { rol: "administrador", id: { not: id }, activo: true },
    });
    if (otrosAdmins === 0) {
      return { error: "No se puede eliminar: es el único administrador activo. Crea otro antes." };
    }
  }

  const [requisiciones, descargos] = await Promise.all([
    prisma.ordenCompra.count({ where: { solicitanteId: id } }),
    prisma.descargoInventario.count({ where: { usuarioId: id } }),
  ]);
  if (requisiciones > 0) {
    return {
      error:
        `No se puede eliminar: ${usuario.nombre} tiene ${requisiciones} requisición(es) a su nombre. ` +
        `Desactiva la cuenta para quitarle el acceso sin perder su historial.`,
    };
  }
  if (descargos > 0) {
    return {
      error:
        `No se puede eliminar: ${usuario.nombre} registró ${descargos} descargo(s) de inventario. ` +
        `Desactiva la cuenta para quitarle el acceso sin perder su historial.`,
    };
  }

  await prisma.usuario.delete({ where: { id } });
  await registrarMovimiento({
    usuarioId: propio, modulo: "Usuarios", accion: "Eliminó usuario",
    detalle: `${usuario.nombre} (${usuario.usuario}) con rol ${usuario.rol}`,
  });
  revalidatePath("/usuarios");
  return { error: null, exito: `Usuario eliminado: ${usuario.nombre} (cuenta "${usuario.usuario}").` };
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

  // El responsable de solicitar solo descarga de SU inventario: aunque el
  // formulario no lo ofrezca, un material que no está en ninguna de sus
  // requisiciones no le corresponde.
  if (inventarioPropio(sesion.user.rol)) {
    const propios = await materialesSolicitadosPor(Number(sesion.user.id));
    if (!propios.includes(materialId)) {
      return { error: "Solo puedes descargar materiales de tus propias requisiciones." };
    }
  }

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
