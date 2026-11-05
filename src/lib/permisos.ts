// Matriz de permisos por rol — Sistema de compras Fundación CAMO
//
// Un solo lugar define qué puede hacer cada rol. Tanto las páginas del
// servidor como los componentes del navegador importan `puede()` para
// decidir si muestran un botón, un menú o si dejan pasar al usuario.
//
//   Administrador           → acceso total (usuarios, bitácora, reportes,
//                             proveedores, materiales, órdenes, inventario,
//                             gestión, compras)
//   Sub Administrador       → reportes, crear/modificar/autorizar órdenes,
//                             alimentar la BD y consultar Gestión y Compras
//   Jefe inmediato          → crear/modificar/autorizar órdenes, reportes y
//                             consultar Gestión y Compras
//   Responsable de gestión  → consultar todas las requisiciones, la
//                             consolidación de Gestión, el módulo Compras,
//                             descargar inventario y ver reportes (no autoriza
//                             ni recibe)
//   Responsable de solicitar→ crear requisiciones y descargar inventario
//
// Gestión y Compras trabajan sobre los mismos renglones: en Gestión se marca
// cada material como Gestionado o Pendiente de Compra y lo que queda pendiente
// aparece en Compras, donde además se registra la entrega (Entregado).
//
// Visibilidad del historial de requisiciones: los roles con "ordenes.verTodas"
// (administrador, sub administrador, jefe inmediato y responsable de gestión)
// ven el historial completo. Cualquier otro usuario ve únicamente las
// requisiciones que él creó.
//
// Los módulos visibles pueden personalizarse por usuario; este archivo define
// el alcance máximo que el rol permite.

export type Rol =
  | "administrador"
  | "sub_administrador"
  | "jefe_inmediato"
  | "responsable_gestion"
  | "responsable_solicitante";

export type Permiso =
  /** Crear usuarios, dar permisos y resetear contraseñas */
  | "usuarios.gestionar"
  /** Ver la bitácora de movimientos */
  | "bitacora.ver"
  /** Ver y generar reportes */
  | "reportes.ver"
  /** Consultar la consolidación de requisiciones de compra */
  | "consolidacion.ver"
  /** Marcar cada material de la consolidación como gestionado o pendiente */
  | "consolidacion.editar"
  /** Consultar el módulo Compras (materiales pendientes y entregados) */
  | "compras.ver"
  /** Marcar materiales como gestionados, pendientes o entregados en Compras */
  | "compras.editar"
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
  /** Ver las requisiciones de todos, no solo las propias */
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
  | "compras"
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
  { valor: "compras", etiqueta: "Compras", descripcion: "Materiales pendientes de comprar y entregas" },
  { valor: "inventario", etiqueta: "Descargo de inventario", descripcion: "Salidas y descargos de bodega" },
  { valor: "reportes", etiqueta: "Reportes", descripcion: "Reportes de gestión y compras" },
  { valor: "bitacora", etiqueta: "Bitácora", descripcion: "Historial de movimientos del sistema" },
  { valor: "usuarios", etiqueta: "Usuarios", descripcion: "Administración de usuarios y accesos" },
];

/** Valor guardado cuando el usuario todavía usa los módulos de su rol. */
export const MODULOS_DEL_ROL = "__rol__" as const;

export const MODULOS_POR_ROL: Record<Rol, Modulo[]> = {
  administrador: MODULOS.map((m) => m.valor),
  sub_administrador: ["panel", "ordenes", "proveedores", "materiales", "gestion", "compras", "inventario", "reportes"],
  jefe_inmediato: ["panel", "ordenes", "proveedores", "materiales", "gestion", "compras", "reportes"],
  // Requisiciones, Gestión, Compras, Descargo de inventario y Reportes (más el
  // panel, que siempre está).
  responsable_gestion: ["panel", "ordenes", "gestion", "compras", "inventario", "reportes"],
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
  "consolidacion.editar": "gestion",
  "compras.ver": "compras",
  "compras.editar": "compras",
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
  "consolidacion.editar",
  "compras.ver",
  "compras.editar",
  "proveedores.gestionar",
  "materiales.gestionar",
  "ordenes.crear",
  "ordenes.editarTodas",
  "ordenes.editarAprobadas",
  "ordenes.autorizar",
  // "ordenes.recibir" no va aquí: registrar la entrega es tarea exclusiva
  // del sub administrador, quien además escribe el nombre de quien recibe.
  "ordenes.verTodas",
  "inventario.descargar",
];

export const PERMISOS_POR_ROL: Record<Rol, Permiso[]> = {
  administrador: ADMIN,
  sub_administrador: [
    "reportes.ver",
    "consolidacion.ver",
    "consolidacion.editar",
    "compras.ver",
    "compras.editar",
    "proveedores.gestionar",
    "materiales.gestionar",
    "ordenes.crear",
    "ordenes.editarTodas",
    "ordenes.editarAprobadas",
    "ordenes.autorizar",
    // Único rol que registra la entrega de una requisición: marca la orden
    // como recibida (suma al inventario) y escribe quién recibió el material.
    "ordenes.recibir",
    "ordenes.verTodas",
    "inventario.descargar",
  ],
  jefe_inmediato: [
    "reportes.ver",
    "consolidacion.ver",
    "consolidacion.editar",
    "compras.ver",
    "compras.editar",
    "ordenes.crear",
    "ordenes.editarTodas",
    "ordenes.autorizar",
    "ordenes.verTodas",
  ],
  // Consulta el historial completo de requisiciones, pero no aprueba, no
  // recibe ni edita las de otros: solo crea las suyas.
  responsable_gestion: [
    "ordenes.crear",
    "ordenes.verTodas",
    "consolidacion.ver",
    "consolidacion.editar",
    "compras.ver",
    "compras.editar",
    "inventario.descargar",
    "reportes.ver",
  ],
  responsable_solicitante: [
    "ordenes.crear",
    // Ya no registra la entrega de sus propias requisiciones: eso lo hace
    // el sub administrador al recibir el material.
    "inventario.descargar",
  ],
};

/** ¿Tiene ese rol ese permiso? Un rol desconocido no tiene ninguno. */
export function puede(rol: string | null | undefined, permiso: Permiso): boolean {
  const lista = PERMISOS_POR_ROL[rol as Rol];
  return lista ? lista.includes(permiso) : false;
}

/** ¿Este rol solo ve su propio inventario: los materiales de las requisiciones
 *  que él solicitó (pendientes o ya recibidas) y los descargos que él registró?
 *  Los demás roles ven el inventario completo de la fundación. */
export function inventarioPropio(rol: string | null | undefined): boolean {
  return rol === "responsable_solicitante";
}

/** Nombre bonito del rol para mostrar en el menú, la bitácora y las etiquetas. */
export function nombreRol(rol: string | null | undefined): string {
  switch (rol) {
    case "administrador": return "Administrador";
    case "sub_administrador": return "Sub Administrador";
    case "jefe_inmediato": return "Jefe inmediato";
    case "responsable_gestion": return "Responsable de gestión";
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
    case "responsable_gestion": return "et-gestion";
    case "responsable_solicitante": return "et-responsable";
    default: return "et-usuario";
  }
}

/** Lista completa para los selectores de rol en los formularios. */
export const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: "administrador", etiqueta: "Administrador" },
  { valor: "sub_administrador", etiqueta: "Sub Administrador" },
  { valor: "jefe_inmediato", etiqueta: "Jefe inmediato" },
  { valor: "responsable_gestion", etiqueta: "Responsable de gestión" },
  { valor: "responsable_solicitante", etiqueta: "Responsable de solicitar" },
];

/** Acepta solo valores de rol del sistema; cualquier cosa rara queda en
 *  "responsable_solicitante" (el rol más limitado que sí existe). */
export function rolValido(valor: unknown): Rol {
  const v = String(valor || "");
  return (ROLES.some((r) => r.valor === v) ? v : "responsable_solicitante") as Rol;
}
