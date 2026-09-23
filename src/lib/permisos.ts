// Matriz de permisos por rol — Sistema de compras Fundación CAMO
//
// Un solo lugar define qué puede hacer cada rol. Tanto las páginas del
// servidor como los componentes del navegador importan `puede()` para
// decidir si muestran un botón, un menú o si dejan pasar al usuario.
//
//   Administrador           → acceso total (usuarios, bitácora, reportes,
//                             proveedores, materiales, órdenes, inventario)
//   Sub Administrador       → reportes, crear/modificar/autorizar órdenes y
//                             alimentar la BD (proveedores e insumos)
//   Jefe inmediato          → crear/modificar/autorizar órdenes y reportes
//   Responsable de solicitar→ crear requisiciones y descargar inventario

export type Rol = "administrador" | "sub_administrador" | "jefe_inmediato" | "responsable_solicitante";

export type Permiso =
  /** Crear usuarios, dar permisos y resetear contraseñas */
  | "usuarios.gestionar"
  /** Ver la bitácora de movimientos */
  | "bitacora.ver"
  /** Ver y generar reportes */
  | "reportes.ver"
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

const ADMIN: Permiso[] = [
  "usuarios.gestionar",
  "bitacora.ver",
  "reportes.ver",
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
