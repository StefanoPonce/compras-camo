"use server";
// Todas las operaciones que cambian datos pasan por aquí. Cada una
// revisa la sesión, hace el cambio, deja el rastro en la bitácora
// y le avisa a Next.js qué páginas debe refrescar.
//
// Las que se usan con useFormState (crear/editar) devuelven
// { error: string | null } en vez de lanzar una excepción — así un
// dato duplicado o un campo vacío se muestra como aviso dentro del
// formulario, en lugar de tumbar la página con el error rojo de Next.js.
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarMovimiento } from "@/lib/bitacora";
import { puede, rolValido, type Permiso } from "@/lib/permisos";
import { leerImagenAdjunta, subirImagenMaterial, borrarImagenMaterial } from "@/lib/imagenes";

export type EstadoForm = { error: string | null };

async function sesionObligatoria() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) redirect("/login");

  // Si el id de la sesión ya no apunta a ningún usuario (por ejemplo, la
  // seed volvió a crear la tabla), no se puede escribir ninguna llave
  // foránea: mejor pedir que vuelva a entrar para refrescar el token.
  const id = Number(sesion.user.id);
  const existe = Number.isInteger(id)
    ? await prisma.usuario.findUnique({ where: { id }, select: { id: true } })
    : null;
  if (!existe) redirect("/login");

  return sesion;
}

/** Devuelve la sesión solo si el rol tiene ese permiso. */
async function exigirPermiso(permiso: Permiso) {
  const sesion = await sesionObligatoria();
  if (!puede(sesion.user.rol, permiso)) {
    throw new Error("Tu rol no tiene permiso para esta acción.");
  }
  return sesion;
}

function lps(n: number) {
  return "L " + n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Lee un entero ≥ 0 del formulario. Vacío → `porDefecto` (así un campo en
 *  blanco nunca bloquea el guardado), con decimal se redondea y lo negativo
 *  o no numérico → null para poder responder con un aviso claro. */
function enteroDelFormulario(valor: unknown, porDefecto: number): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return porDefecto;
  const n = Number(texto);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/** Igual que `enteroDelFormulario` pero acepta decimales (precios). */
function decimalDelFormulario(valor: unknown, porDefecto: number): number | null {
  const texto = String(valor ?? "").trim();
  if (!texto) return porDefecto;
  const n = Number(texto);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Convierte un error de restricción única de Prisma (P2002) en un
 *  mensaje legible. Si el error no es de ese tipo, lo vuelve a lanzar
 *  para que no se esconda un problema real (por ejemplo de conexión). */
function mensajeSiEsDuplicado(e: unknown, camposLegibles: Record<string, string>): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    const objetivo = (e.meta?.target as string[] | undefined) || [];
    const campo = objetivo.find((c) => camposLegibles[c]);
    if (campo) return `Ya existe un registro con ese ${camposLegibles[campo]}. Usa otro valor.`;
    return "Ya existe un registro con ese dato. Usa otro valor.";
  }
  throw e;
}

/* ------------------------------ PROVEEDORES ------------------------------ */

/** Siguiente código libre en el formato PROV-001, PROV-002… El Excel del
 *  catálogo trae esa columna vacía, así que siempre hay que terminar con un
 *  valor (a mano o generado). */
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
      detalle: `${proveedor.nombre} (${proveedor.codigo})${proveedor.rtn ? " · RTN " + proveedor.rtn : ""}`,
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

/* ------------------------------- MATERIALES ------------------------------- */

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

  // Campos numéricos opcionales: vacío = 0, y nunca bloquean el guardado.
  const existencia = enteroDelFormulario(datos.get("existencia"), 0);
  const minimo = enteroDelFormulario(datos.get("minimo"), 0);
  const precio = decimalDelFormulario(datos.get("precio"), 0);
  if (existencia === null) return { error: "La existencia debe ser un número igual o mayor a cero." };
  if (minimo === null) return { error: "El mínimo en bodega debe ser un número igual o mayor a cero." };
  if (precio === null) return { error: "El precio debe ser un número igual o mayor a cero." };

  // Con variantes dos materiales pueden compartir nombre (BOLSA PLASTICA 4X8
  // y 6X10), así que solo chocan cuando coinciden el nombre Y la variante.
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

  // La imagen se sube primero para poder guardar su URL en la misma
  // consulta; si luego el material no se crea, se borra para no dejar
  // archivos huérfanos en el storage.
  let imagenUrl: string | null = null;
  try {
    if (adjunta.archivo) imagenUrl = await subirImagenMaterial(adjunta.archivo);

    const material = await prisma.material.create({
      data: {
        codigo, nombre, categoria, unidad,
        familia: familia || null,
        variante: variante || null,
        existencia,
        minimo,
        precioUltimo: precio,
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

  // Aquí NO se valida el nombre contra los demás materiales: el catálogo del
  // Excel trae 12 parejas con el mismo nombre y códigos distintos, y bloquear
  // la edición dejaría esos productos incompletables. La unicidad real la
  // garantiza el código (columna única en la base).

  const adjunta = leerImagenAdjunta(datos);
  if (adjunta.error) return { error: adjunta.error };

  const anterior = await prisma.material.findUniqueOrThrow({ where: { id } });
  // Numéricos opcionales: vacío = conserva el valor que ya tenía el material
  // (así se puede editar sin tocar la existencia ni bajarla sin querer).
  const nuevaExistencia = enteroDelFormulario(datos.get("existencia"), anterior.existencia);
  const nuevoMinimo = enteroDelFormulario(datos.get("minimo"), anterior.minimo);
  const nuevoPrecio = decimalDelFormulario(datos.get("precio"), Number(anterior.precioUltimo));
  if (nuevaExistencia === null) return { error: "La existencia debe ser un número igual o mayor a cero." };
  if (nuevoMinimo === null) return { error: "El mínimo en bodega debe ser un número igual o mayor a cero." };
  if (nuevoPrecio === null) return { error: "El precio debe ser un número igual o mayor a cero." };

  const quitarImagen = datos.get("quitarImagen") === "1";
  // Regla sencilla: si llega archivo nuevo manda ese; si no, si marcó
  // "quitar" se deja sin imagen; si no, se conserva la que ya tenía.
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
        codigo, nombre, categoria, unidad,
        familia: familia || null,
        variante: variante || null,
        existencia: nuevaExistencia,
        minimo: nuevoMinimo,
        precioUltimo: nuevoPrecio,
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
    // Recién cuando la BD ya quedó con la URL nueva se borra la foto
    // anterior del storage.
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
  if (usado > 0) return { error: "No se puede eliminar: aparece en órdenes ya registradas." };

  const material = await prisma.material.delete({ where: { id } });
  await borrarImagenMaterial(material.imagenUrl);
  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Materiales", accion: "Eliminó material",
    detalle: `${material.codigo} — ${material.nombre}`,
  });
  revalidatePath("/materiales");
  return { error: null };
}

/* ----------------------------- ÓRDENES DE COMPRA ----------------------------- */

/** De dónde sale el proveedor de la orden. Manda lo que se eligió en el
 *  formulario (una columna por renglón); si ese renglón quedó vacío, se usa
 *  el proveedor que tenga asignado el material. El catálogo del Excel no
 *  relaciona materiales con proveedores, así que muchos llegan sin uno y hay
 *  que poder elegirlo aquí mismo. */
async function resolverProveedorDeItems(
  items: { materialId: number; proveedorId: number | null }[],
): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const elegido = items.find((it) => it.proveedorId);
  if (elegido?.proveedorId) return { ok: true, id: elegido.proveedorId };

  const materiales = await prisma.material.findMany({
    where: { id: { in: items.map((it) => it.materialId) } },
    select: { id: true, proveedorId: true },
  });
  const porId = new Map(materiales.map((m) => [m.id, m]));
  const conProveedor = items.find((it) => porId.get(it.materialId)?.proveedorId);
  if (conProveedor) {
    const id = porId.get(conProveedor.materialId)!.proveedorId!;
    return { ok: true, id };
  }

  return { ok: false, error: "Elige el proveedor de la orden en la columna \"Proveedor\" del primer renglón." };
}

function leerItems(datos: FormData) {
  const materialIds = datos.getAll("materialId") as string[];
  const cantidades = datos.getAll("cantidad") as string[];
  const precios = datos.getAll("precio") as string[];
  const proveedores = datos.getAll("proveedorId") as string[];
  return materialIds
    .map((mid, i) => ({
      materialId: Number(mid),
      cantidad: Number(cantidades[i]),
      precio: Number(precios[i]),
      // Siempre hay un valor por renglón (aunque sea vacío) para que los
      // arreglos queden alineados con getAll("materialId").
      proveedorId: Number(proveedores[i]) || null,
    }))
    .filter((it) => it.materialId && it.cantidad > 0);
}

export async function crearOrden(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("ordenes.crear");
  const dependencia = String(datos.get("dependencia") || "").trim();
  const lugar = String(datos.get("lugar") || "").trim();
  const justificacion = String(datos.get("justificacion") || "").trim();
  const items = leerItems(datos);

  if (!dependencia) return { error: "La dependencia es obligatoria." };
  if (!lugar) return { error: "El lugar es obligatorio." };
  if (!items.length) return { error: "Agrega al menos un material con cantidad mayor a cero." };

  const proveedor = await resolverProveedorDeItems(items);
  if (!proveedor.ok) return proveedor;

  const total = items.reduce((s, it) => s + it.cantidad * it.precio, 0);
  const anio = new Date().getFullYear();

  let ordenId: number;
  try {
    const enElAnio = await prisma.ordenCompra.count({ where: { folio: { startsWith: `OC-${anio}-` } } });
    const folio = `OC-${anio}-${String(enElAnio + 1).padStart(4, "0")}`;

    const orden = await prisma.ordenCompra.create({
      data: {
        folio, proveedorId: proveedor.id, dependencia: dependencia || null, lugar: lugar || null, justificacion,
        solicitanteId: Number(sesion.user.id),
        total,
        // Cada renglón guarda además su propio proveedor: es el que muestra
        // la requisición al imprimir. `proveedorId` vacío queda en null y la
        // impresión cae al proveedor de la orden.
        items: {
          create: items.map(({ materialId, cantidad, precio, proveedorId }) => ({ materialId, cantidad, precio, proveedorId })),
        },
      },
    });
    ordenId = orden.id;

    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Órdenes", accion: "Creó orden",
      detalle: `${orden.folio} por ${lps(total)} (${items.length} material(es))`,
    });
  } catch (e) {
    console.error("crearOrden:", e);
    return { error: "No se pudo crear la orden. Verifica los datos e intenta de nuevo." };
  }

  revalidatePath("/ordenes");
  redirect(`/ordenes/${ordenId}`);
}

export async function editarOrden(id: number, _prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await sesionObligatoria();
  const puedeTodas = puede(sesion.user.rol, "ordenes.editarTodas");
  const puedeAprobadas = puede(sesion.user.rol, "ordenes.editarAprobadas");

  const orden = await prisma.ordenCompra.findUniqueOrThrow({ where: { id } });
  const esPropia = orden.solicitanteId === Number(sesion.user.id);

  // Recibida: ya no se toca. Aprobada: solo administración. El resto: su
  // solicitante o quien puede editar todas.
  if (orden.estado === "Recibida") {
    return { error: "Una orden recibida ya no puede editarse." };
  }
  if (orden.estado === "Aprobada" && !puedeAprobadas) {
    return { error: "Solo el administrador o el sub administrador pueden editar una requisición aprobada." };
  }
  if (orden.estado !== "Aprobada" && !puedeTodas && !esPropia) {
    return { error: "Solo el solicitante o un rol con permiso de edición pueden editar esta orden." };
  }
  const eraAprobada = orden.estado === "Aprobada";

  const dependencia = String(datos.get("dependencia") || "").trim();
  const lugar = String(datos.get("lugar") || "").trim();
  const justificacion = String(datos.get("justificacion") || "").trim();
  const items = leerItems(datos);

  if (!dependencia) return { error: "La dependencia es obligatoria." };
  if (!lugar) return { error: "El lugar es obligatorio." };
  if (!items.length) return { error: "Agrega al menos un material con cantidad mayor a cero." };

  const proveedor = await resolverProveedorDeItems(items);
  if (!proveedor.ok) return proveedor;

  const total = items.reduce((s, it) => s + it.cantidad * it.precio, 0);

  try {
    await prisma.$transaction([
      prisma.detalleOrden.deleteMany({ where: { ordenId: id } }),
      ...items.map((it) =>
        prisma.detalleOrden.create({
          data: {
            ordenId: id,
            materialId: it.materialId,
            cantidad: it.cantidad,
            precio: it.precio,
            proveedorId: it.proveedorId,
          },
        })
      ),
      prisma.ordenCompra.update({
        where: { id },
        data: {
          proveedorId: proveedor.id, dependencia, lugar, justificacion, total,
          // La aprobada se edita pero conserva su estado y su revisión; las
          // demás vuelven a quedar pendientes de revisión.
          ...(eraAprobada
            ? {}
            : { estado: "Pendiente", revisorId: null, fechaRevision: null, comentario: null }),
        },
      }),
    ]);
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Órdenes", accion: "Editó orden",
      detalle: `${orden.folio} — se actualizaron los materiales y quedó ` +
        (eraAprobada ? "aprobada." : "pendiente de revisión."),
    });
  } catch {
    return { error: "No se pudo guardar la orden. Verifica los datos e intenta de nuevo." };
  }

  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${id}`);
  redirect(`/ordenes/${id}`);
}

export async function resolverOrden(id: number, nuevoEstado: "Aprobada" | "Rechazada", comentario: string) {
  const sesion = await exigirPermiso("ordenes.autorizar");
  const actual = await prisma.ordenCompra.findUniqueOrThrow({ where: { id } });
  if (actual.estado !== "Pendiente") {
    throw new Error("Esta orden ya fue revisada (aprobada o rechazada).");
  }

  const orden = await prisma.ordenCompra.update({
    where: { id },
    data: { estado: nuevoEstado, revisorId: Number(sesion.user.id), fechaRevision: new Date(), comentario },
  });

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Órdenes",
    accion: nuevoEstado === "Aprobada" ? "Aprobó orden" : "Rechazó orden",
    detalle: `${orden.folio} por ${lps(Number(orden.total))}${comentario ? " — " + comentario : ""}`,
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
    throw new Error("Solo se puede marcar como recibida una orden aprobada.");
  }

  await prisma.$transaction([
    ...orden.items.map((it) =>
      prisma.material.update({
        where: { id: it.materialId },
        data: { existencia: { increment: it.cantidad }, precioUltimo: it.precio },
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

/* -------------------------------- USUARIOS -------------------------------- */

export async function crearUsuario(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirPermiso("usuarios.gestionar");
  const nombre = String(datos.get("nombre") || "").trim();
  const usuario = String(datos.get("usuario") || "").trim().toLowerCase();
  const clave = String(datos.get("clave") || "");
  const rol = rolValido(datos.get("rol"));

  if (!nombre || !usuario) return { error: "El nombre y la cuenta son obligatorios." };
  if (clave.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };

  try {
    const claveHash = await bcrypt.hash(clave, 10);
    await prisma.usuario.create({ data: { nombre, usuario, claveHash, rol } });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Usuarios", accion: "Creó usuario",
      detalle: `${nombre} (${usuario}) con rol ${rol}`,
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
  const clave = String(datos.get("clave") || "");
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (clave && clave.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };

  try {
    const anterior = await prisma.usuario.findUniqueOrThrow({ where: { id } });
    const data: { nombre: string; rol: typeof rol; claveHash?: string } = { nombre, rol };
    if (clave) data.claveHash = await bcrypt.hash(clave, 10);

    await prisma.usuario.update({ where: { id }, data });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Usuarios", accion: "Editó usuario",
      detalle: nombre + (anterior.rol !== rol ? ` (rol ${anterior.rol} → ${rol})` : "") + (clave ? " — se cambió la contraseña" : ""),
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
  const actualizado = await prisma.usuario.update({ where: { id }, data: { activo: !usuario.activo } });

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Usuarios",
    accion: actualizado.activo ? "Activó usuario" : "Desactivó usuario",
    detalle: `${actualizado.nombre} (${actualizado.usuario})`,
  });
  revalidatePath("/usuarios");
}

/* --------------------------- DESCARGO DE INVENTARIO --------------------------- */

/** Resta existencia a un material (salida de bodega). Deja el renglón en
 *  `descargos_inventario` con cuánto había, cuánto se llevó y quién lo hizo,
 *  y el rastro en la bitácora. */
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
        // Ya se validó arriba que el usuario de la sesión existe; si el id
        // fuera inválido, Postgres rechazaría la fila por la llave foránea.
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
