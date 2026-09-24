// Matriz de permisos por rol — Sistema de compras Fundación CAMO
//
// Un solo lugar define qué puede hacer cada rol. Tanto las páginas del
// servidor como los componentes del navegador importan `puede()` para
// decidir si muestran un botón, un menú o si dejan pasar al usuario.
//
//   Administrador           → acceso total (usuarios, bitácora, reportes,
//                             proveedores, materiales, órdenes, inventario,
//                             gestión)
//   Sub Administrador       → reportes, crear/modificar/autorizar órdenes,
//                             alimentar la BD y consultar Gestión
//   Jefe inmediato          → crear/modificar/autorizar órdenes, reportes y
//                             consultar Gestión
//   Responsable de solicitar→ crear requisiciones y descargar inventario
//
// Los módulos visibles pueden personalizarse por usuario; este archivo define
// el alcance máximo que el rol permite.

export type Rol = "administrador" | "sub_administrador" | "jefe_inmediato" | "responsable_solicitante";

export type Permiso =
  /** Crear usuarios, dar permisos y resetear contraseñas */
  | "usuarios.gestionar"
  /** Ver la bitácora de movimientos */
  | "bitacora.ver"
  /** Ver y generar reportes */
  | "reportes.ver"
  /** Consultar la consolidación de requisiciones de compra */
  | "consolidacion.ver"
  /** Crear, editar y eliminar proveedores */
  | "proveedores.gestionar"
  /** Crear, editar y eliminar materiales (insumos) */
  | "materiales.gestionar"
  /** Crear requisiciones (órdenes de compra) */
  | "ordenes.crear"
  /** Editar órdenes de otros solicitantes */
  | "ordenes.editarTodas"
  /** Editar una requisición ya aprobada (solo administración) */
  | "ordenes.editarAprobadas"
  /** Aprobar o rechazar órdenes */
  | "ordenes.autorizar"
  /** Marcar órdenes como recibidas (suma al inventario) */
  | "ordenes.recibir"
  /** Ver las órdenes de todos, no solo las propias */
  | "ordenes.verTodas"
  /** Restar productos del inventario (descargo) */
  | "inventario.descargar";

/** Módulos que se pueden mostrar en el menú y proteger por usuario. */
export type Modulo =
  | "panel"
  | "ordenes"
  | "proveedores"
  | "materiales"
  | "gestion"
  | "inventario"
  | "reportes"
  | "bitacora"
  | "usuarios";

export const MODULOS: { valor: Modulo; etiqueta: string; descripcion: string }[] = [
  { valor: "panel", etiqueta: "Panel", descripcion: "Resumen general del sistema" },
  { valor: "ordenes", etiqueta: "Órdenes de compra", descripcion: "Solicitudes y seguimiento de compras" },
  { valor: "proveedores", etiqueta: "Proveedores", descripcion: "Catálogo y datos de proveedores" },
  { valor: "materiales", etiqueta: "Materiales", descripcion: "Catálogo e inventario de materiales" },
  { valor: "gestion", etiqueta: "Gestión", descripcion: "Consolidación de requisiciones de compra" },
  { valor: "inventario", etiqueta: "Descargo de inventario", descripcion: "Salidas y descargos de bodega" },
  { valor: "reportes", etiqueta: "Reportes", descripcion: "Reportes de gestión y compras" },
  { valor: "bitacora", etiqueta: "Bitácora", descripcion: "Historial de movimientos del sistema" },
  { valor: "usuarios", etiqueta: "Usuarios", descripcion: "Administración de usuarios y accesos" },
];

/** Valor guardado cuando el usuario todavía usa los módulos de su rol. */
export const MODULOS_DEL_ROL = "__rol__" as const;

export const MODULOS_POR_ROL: Record<Rol, Modulo[]> = {
  administrador: MODULOS.map((m) => m.valor),
  sub_administrador: ["panel", "ordenes", "proveedores", "materiales", "gestion", "inventario", "reportes"],
  jefe_inmediato: ["panel", "ordenes", "proveedores", "materiales", "gestion", "reportes"],
  responsable_solicitante: ["panel", "ordenes", "proveedores", "materiales", "inventario"],
};

export function modulosDeRol(rol: string | null | undefined): Modulo[] {
  const lista = MODULOS_POR_ROL[rol as Rol];
  return lista ? [...lista] : ["panel"];
}

/** Convierte el valor de la base en una lista segura para la sesión. */
export function normalizarModulos(
  valor: readonly string[] | null | undefined,
  rol: string | null | undefined,
): Modulo[] {
  const disponibles = modulosDeRol(rol);

  // Un administrador siempre conserva acceso total para no quedarse fuera
  // del panel que le permite administrar a los demás usuarios.
  if (rol === "administrador") return disponibles;
  if (!valor || (valor.length === 1 && valor[0] === MODULOS_DEL_ROL)) return disponibles;

  const elegidos = new Set(valor);
  return disponibles.filter((modulo) => elegidos.has(modulo));
}

export function puedeVerModulo(
  rol: string | null | undefined,
  valor: readonly string[] | null | undefined,
  modulo: Modulo,
): boolean {
  return normalizarModulos(valor, rol).includes(modulo);
}

/** Módulo que protege cada permiso de escritura del servidor. */
export const MODULO_DE_PERMISO: Partial<Record<Permiso, Modulo>> = {
  "usuarios.gestionar": "usuarios",
  "bitacora.ver": "bitacora",
  "reportes.ver": "reportes",
  "consolidacion.ver": "gestion",
  "proveedores.gestionar": "proveedores",
  "materiales.gestionar": "materiales",
  "ordenes.crear": "ordenes",
  "ordenes.editarTodas": "ordenes",
  "ordenes.editarAprobadas": "ordenes",
  "ordenes.autorizar": "ordenes",
  "ordenes.recibir": "ordenes",
  "ordenes.verTodas": "ordenes",
  "inventario.descargar": "inventario",
};

const ADMIN: Permiso[] = [
  "usuarios.gestionar",
  "bitacora.ver",
  "reportes.ver",
  "consolidacion.ver",
  "proveedores.gestionar",
  "materiales.gestionar",
  "ordenes.crear",
  "ordenes.editarTodas",
  "ordenes.editarAprobadas",
  "ordenes.autorizar",
  "ordenes.recibir",
  "ordenes.verTodas",
  "inventario.descargar",
];

export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  administrador: ADMIN,
  sub_administrador: [
    "reportes.ver",
    "consolidacion.ver",
    "proveedores.gestionar",
    "materiales.gestionar",
    "ordenes.crear",
    "ordenes.editarTodas",
    "ordenes.editarAprobadas",
    "ordenes.autorizar",
    "ordenes.recibir",
    "ordenes.verTodas",
    "inventario.descargar",
  ],
  jefe_inmediato: [
    "reportes.ver",
    "consolidacion.ver",
    "ordenes.crear",
    "ordenes.editarTodas",
    "ordenes.autorizar",
    "ordenes.verTodas",
  ],
  responsable_solicitante: [
    "ordenes.crear",
    "ordenes.recibir",
    "ordenes.verTodas",
    "inventario.descargar",
  ],
};

/** ¿Tiene ese rol ese permiso? Un rol desconocido no tiene ninguno. */
export function puede(rol: string | null | undefined, permiso: Permiso): boolean {
  const lista = PERMISOS_POR_ROL[rol as Rol];
  return lista ? lista.includes(permiso) : false;
}

/** Nombre bonito del rol para mostrar en el menú, la bitácora y las etiquetas. */
export function nombreRol(rol: string | null | undefined): string {
  switch (rol) {
    case "administrador": return "Administrador";
    case "sub_administrador": return "Sub Administrador";
    case "jefe_inmediato": return "Jefe inmediato";
    case "responsable_solicitante": return "Responsable de solicitar";
    default: return rol || "—";
  }
}

/** Clase CSS de la etiqueta de color según el rol. */
export function claseRol(rol: string | null | undefined): string {
  switch (rol) {
    case "administrador": return "et-admin";
    case "sub_administrador": return "et-subadmin";
    case "jefe_inmediato": return "et-jefe";
    case "responsable_solicitante": return "et-responsable";
    default: return "et-usuario";
  }
}

/** Lista completa para los selectores de rol en los formularios. */
export const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: "administrador", etiqueta: "Administrador" },
  { valor: "sub_administrador", etiqueta: "Sub Administrador" },
  { valor: "jefe_inmediato", etiqueta: "Jefe inmediato" },
  { valor: "responsable_solicitante", etiqueta: "Responsable de solicitar" },
];

/** Acepta solo valores de rol del sistema; cualquier cosa rara queda en
 *  "responsable_solicitante" (el rol más limitado que sí existe). */
export function rolValido(valor: unknown): Rol {
  const v = String(valor || "");
  return (ROLES.some((r) => r.valor === v) ? v : "responsable_solicitante") as Rol;
}
