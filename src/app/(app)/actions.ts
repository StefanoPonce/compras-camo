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

export type EstadoForm = { error: string | null };

async function sesionObligatoria() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) redirect("/login");
  return sesion;
}

async function exigirAdmin() {
  const sesion = await sesionObligatoria();
  if (sesion.user.rol !== "administrador") {
    throw new Error("Esta acción requiere una cuenta de administrador.");
  }
  return sesion;
}

function lps(n: number) {
  return "L " + n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

export async function crearProveedor(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirAdmin();
  const nombre = String(datos.get("nombre") || "").trim();
  if (!nombre) return { error: "El nombre del proveedor es obligatorio." };

  const repetido = await prisma.proveedor.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } });
  if (repetido) return { error: `Ya existe un proveedor llamado "${repetido.nombre}". Usa un nombre distinto o edita el existente.` };

  try {
    const proveedor = await prisma.proveedor.create({
      data: {
        nombre,
        rtn: String(datos.get("rtn") || "").trim() || null,
        contacto: String(datos.get("contacto") || "").trim() || null,
        telefono: String(datos.get("telefono") || "").trim() || null,
        correo: String(datos.get("correo") || "").trim() || null,
        direccion: String(datos.get("direccion") || "").trim() || null,
      },
    });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Proveedores", accion: "Registró proveedor",
      detalle: `${proveedor.nombre}${proveedor.rtn ? " (RTN " + proveedor.rtn + ")" : ""}`,
    });
  } catch (e) {
    return { error: mensajeSiEsDuplicado(e, { rtn: "RTN" }) };
  }

  revalidatePath("/proveedores");
  return { error: null };
}

export async function editarProveedor(id: number, _prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirAdmin();
  const nombre = String(datos.get("nombre") || "").trim();
  if (!nombre) return { error: "El nombre del proveedor es obligatorio." };

  const repetido = await prisma.proveedor.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, NOT: { id } },
  });
  if (repetido) return { error: `Ya existe otro proveedor llamado "${repetido.nombre}". Usa un nombre distinto.` };

  try {
    const proveedor = await prisma.proveedor.update({
      where: { id },
      data: {
        nombre,
        rtn: String(datos.get("rtn") || "").trim() || null,
        contacto: String(datos.get("contacto") || "").trim() || null,
        telefono: String(datos.get("telefono") || "").trim() || null,
        correo: String(datos.get("correo") || "").trim() || null,
        direccion: String(datos.get("direccion") || "").trim() || null,
        activo: datos.get("activo") === "1",
      },
    });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Proveedores", accion: "Editó proveedor", detalle: proveedor.nombre,
    });
  } catch (e) {
    return { error: mensajeSiEsDuplicado(e, { rtn: "RTN" }) };
  }

  revalidatePath("/proveedores");
  redirect("/proveedores");
}

export async function eliminarProveedor(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirAdmin();
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
  const sesion = await exigirAdmin();
  const codigo = String(datos.get("codigo") || "").trim();
  const nombre = String(datos.get("nombre") || "").trim();
  const categoria = String(datos.get("categoria") || "").trim();
  const unidad = String(datos.get("unidad") || "").trim();
  if (!codigo || !nombre) return { error: "El código y el nombre son obligatorios." };
  if (!categoria) return { error: "La categoría es obligatoria." };
  if (!unidad) return { error: "La unidad de medida es obligatoria." };

  const nombreRepetido = await prisma.material.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" } } });
  if (nombreRepetido) {
    return { error: `Ya existe un material llamado "${nombreRepetido.nombre}" (código ${nombreRepetido.codigo}). Usa un nombre distinto o edita ese material.` };
  }

  try {
    const material = await prisma.material.create({
      data: {
        codigo, nombre, categoria, unidad,
        existencia: Number(datos.get("existencia") || 0),
        minimo: Number(datos.get("minimo") || 0),
        precioUltimo: Number(datos.get("precio") || 0),
        proveedorId: Number(datos.get("proveedorId")) || null,
      },
    });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Materiales", accion: "Registró material",
      detalle: `${material.codigo} — ${material.nombre}`,
    });
  } catch (e) {
    return { error: mensajeSiEsDuplicado(e, { codigo: "código" }) };
  }

  revalidatePath("/materiales");
  return { error: null };
}

export async function editarMaterial(id: number, _prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirAdmin();
  const codigo = String(datos.get("codigo") || "").trim();
  const nombre = String(datos.get("nombre") || "").trim();
  const categoria = String(datos.get("categoria") || "").trim();
  const unidad = String(datos.get("unidad") || "").trim();
  if (!codigo || !nombre) return { error: "El código y el nombre son obligatorios." };
  if (!categoria) return { error: "La categoría es obligatoria." };
  if (!unidad) return { error: "La unidad de medida es obligatoria." };

  const nombreRepetido = await prisma.material.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" }, NOT: { id } },
  });
  if (nombreRepetido) {
    return { error: `Ya existe otro material llamado "${nombreRepetido.nombre}" (código ${nombreRepetido.codigo}). Usa un nombre distinto.` };
  }

  try {
    const anterior = await prisma.material.findUniqueOrThrow({ where: { id } });
    const nuevaExistencia = Number(datos.get("existencia") || 0);

    const material = await prisma.material.update({
      where: { id },
      data: {
        codigo, nombre, categoria, unidad,
        existencia: nuevaExistencia,
        minimo: Number(datos.get("minimo") || 0),
        precioUltimo: Number(datos.get("precio") || 0),
        proveedorId: Number(datos.get("proveedorId")) || null,
      },
    });
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Materiales", accion: "Editó material",
      detalle: `${material.codigo} — ${material.nombre}` +
        (anterior.existencia !== nuevaExistencia ? ` (existencia ${anterior.existencia} → ${nuevaExistencia})` : ""),
    });
  } catch (e) {
    return { error: mensajeSiEsDuplicado(e, { codigo: "código" }) };
  }

  revalidatePath("/materiales");
  redirect("/materiales");
}

export async function eliminarMaterial(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await exigirAdmin();
  const id = Number(datos.get("id"));
  const usado = await prisma.detalleOrden.count({ where: { materialId: id } });
  if (usado > 0) return { error: "No se puede eliminar: aparece en órdenes ya registradas." };

  const material = await prisma.material.delete({ where: { id } });
  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Materiales", accion: "Eliminó material",
    detalle: `${material.codigo} — ${material.nombre}`,
  });
  revalidatePath("/materiales");
  return { error: null };
}

/* ----------------------------- ÓRDENES DE COMPRA ----------------------------- */

/** Elige automáticamente el proveedor de la orden desde el material del primer
 *  renglón: en el formulario ya no se elige proveedor, se completa solo. */
async function resolverProveedorDeItems(items: { materialId: number }[]): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const materiales = await prisma.material.findMany({
    where: { id: { in: items.map((it) => it.materialId) } },
    select: { id: true, proveedorId: true },
  });
  const porId = new Map(materiales.map((m) => [m.id, m]));
  const primero = porId.get(items[0].materialId);
  if (!primero?.proveedorId) {
    return { ok: false, error: "El material del primer renglón no tiene proveedor asignado. Asígnalo en el catálogo de materiales." };
  }
  return { ok: true, id: primero.proveedorId };
}

function leerItems(datos: FormData) {
  const materialIds = datos.getAll("materialId") as string[];
  const cantidades = datos.getAll("cantidad") as string[];
  const precios = datos.getAll("precio") as string[];
  return materialIds
    .map((mid, i) => ({
      materialId: Number(mid),
      cantidad: Number(cantidades[i]),
      precio: Number(precios[i]),
    }))
    .filter((it) => it.materialId && it.cantidad > 0);
}

export async function crearOrden(_prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await sesionObligatoria();
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
        items: { create: items },
      },
    });
    ordenId = orden.id;

    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Órdenes", accion: "Creó orden",
      detalle: `${orden.folio} por ${lps(total)} (${items.length} material(es))`,
    });
  } catch {
    return { error: "No se pudo crear la orden. Verifica los datos e intenta de nuevo." };
  }

  revalidatePath("/ordenes");
  redirect(`/ordenes/${ordenId}`);
}

export async function editarOrden(id: number, _prev: EstadoForm, datos: FormData): Promise<EstadoForm> {
  const sesion = await sesionObligatoria();
  const esAdmin = sesion.user.rol === "administrador";

  const orden = await prisma.ordenCompra.findUniqueOrThrow({ where: { id } });
  if (orden.estado !== "Pendiente" && orden.estado !== "Rechazada") {
    return { error: "Una orden aprobada o recibida no puede editarse." };
  }
  if (!esAdmin && orden.solicitanteId !== Number(sesion.user.id)) {
    return { error: "Solo el solicitante o un administrador pueden editar esta orden." };
  }

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
        prisma.detalleOrden.create({ data: { ordenId: id, materialId: it.materialId, cantidad: it.cantidad, precio: it.precio } })
      ),
      prisma.ordenCompra.update({
        where: { id },
        data: {
          proveedorId: proveedor.id, dependencia, lugar, justificacion, total,
          estado: "Pendiente", revisorId: null, fechaRevision: null, comentario: null,
        },
      }),
    ]);
    await registrarMovimiento({
      usuarioId: Number(sesion.user.id), modulo: "Órdenes", accion: "Editó orden",
      detalle: `${orden.folio} — se actualizaron los materiales y quedó pendiente de revisión.`,
    });
  } catch {
    return { error: "No se pudo guardar la orden. Verifica los datos e intenta de nuevo." };
  }

  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${id}`);
  redirect(`/ordenes/${id}`);
}

export async function resolverOrden(id: number, nuevoEstado: "Aprobada" | "Rechazada", comentario: string) {
  const sesion = await exigirAdmin();
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
  const sesion = await exigirAdmin();
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
  const sesion = await exigirAdmin();
  const nombre = String(datos.get("nombre") || "").trim();
  const usuario = String(datos.get("usuario") || "").trim().toLowerCase();
  const clave = String(datos.get("clave") || "");
  const rol = String(datos.get("rol") || "usuario") as "usuario" | "administrador";

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
  const sesion = await exigirAdmin();
  const nombre = String(datos.get("nombre") || "").trim();
  const rol = String(datos.get("rol") || "usuario") as "usuario" | "administrador";
  const clave = String(datos.get("clave") || "");
  if (!nombre) return { error: "El nombre es obligatorio." };
  if (clave && clave.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };

  try {
    const anterior = await prisma.usuario.findUniqueOrThrow({ where: { id } });
    const data: { nombre: string; rol: "usuario" | "administrador"; claveHash?: string } = { nombre, rol };
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
  const sesion = await exigirAdmin();
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id } });
  const actualizado = await prisma.usuario.update({ where: { id }, data: { activo: !usuario.activo } });

  await registrarMovimiento({
    usuarioId: Number(sesion.user.id), modulo: "Usuarios",
    accion: actualizado.activo ? "Activó usuario" : "Desactivó usuario",
    detalle: `${actualizado.nombre} (${actualizado.usuario})`,
  });
  revalidatePath("/usuarios");
}
