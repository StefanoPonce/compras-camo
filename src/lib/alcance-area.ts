// Alcance de las requisiciones por área (gerencia) — Sistema de compras Fundación CAMO
//
// Cada cuenta de usuario puede tener una gerencia asignada (usuarios.area, el
// mismo catálogo que la dependencia de las requisiciones: ver
// src/lib/dependencias.ts). Con ese dato este archivo decide DOS cosas, y las
// decide en un solo lugar para que el listado, el panel, el detalle y la
// impresión nunca se contradigan:
//
//   1. QUIÉN VE QUÉ (alcanceRequisiciones / veLaRequisicion)
//        · administrador, sub administrador y responsable de gestión → todas
//          las áreas: son los que cierran el ciclo en Gestión y Compras.
//        · jefe inmediato con área              → solo las de SU gerencia.
//        · jefe inmediato sin área todavía      → solo las suyas (hasta que
//          el administrador le asigne una gerencia).
//        · quien no tiene "ver todas" (responsable de solicitar) → solo las
//          suyas, como siempre.
//
//   2. QUIÉN AUTORIZA QUÉ (errorDeAutorizacion)
//        · el jefe inmediato solo aprueba o rechaza las de su gerencia; si no
//          tiene área asignada, no autoriza ninguna.
//        · administrador y sub administrador autorizan cualquier área (son el
//          respaldo si el jefe de esa gerencia no está disponible).
//
// La responsabilidad de gestión y de compras NO se limita por área: cuando una
// requisición queda aprobada pasa a gestión normal y esos roles la procesan
// sin importar de qué gerencia venga.
import type { Prisma } from "@prisma/client";
import { normalizarDependencia, textoDependencia } from "@/lib/dependencias";
import { puede } from "@/lib/permisos";

/** Lo mínimo que hace falta de la sesión para repartir las requisiciones. */
export type AlcanceSesion = {
  id: string | number;
  rol: string | null | undefined;
  /** Gerencia del usuario, tal como viene de la sesión (usuarios.area). */
  area?: string | null;
};

/** Roles cuyo trabajo es transversal: ven y gestionan todas las áreas. */
export function veTodasLasAreas(rol: string | null | undefined): boolean {
  return rol === "administrador" || rol === "sub_administrador" || rol === "responsable_gestion";
}

/** Gerencia limpia del usuario; "" cuando todavía no tiene una asignada. */
export function areaDe(sesion: AlcanceSesion | { area?: string | null }): string {
  return normalizarDependencia(sesion.area);
}

/**
 * Condición de Prisma que limita las requisiciones visibles al alcance del
 * usuario en sesión. Se junta (con spread) al `where` de cualquier consulta:
 *
 *     where: { ...alcanceRequisiciones(sesion), OR: [...] }
 *
 * Devuelve algo de UNA sola condición a propósito, para que siga pudiendo
 * convivir con el `OR` de los borradores que ya usan las páginas.
 */
export function alcanceRequisiciones(sesion: AlcanceSesion): Prisma.OrdenCompraWhereInput {
  // Sin permiso de "ver todas" solo interesan las propias (rol solicitante).
  if (!puede(sesion.rol, "ordenes.verTodas")) return { solicitanteId: Number(sesion.id) };

  // Administración y gestión ven todas las áreas.
  if (veTodasLasAreas(sesion.rol)) return {};

  const area = areaDe(sesion);
  // Jefe de área: las de su gerencia. Sin área asignada todavía, solo las suyas.
  return area ? { dependencia: area } : { solicitanteId: Number(sesion.id) };
}

/**
 * ¿Puede este usuario abrir ESTA requisición? Su propia requisición siempre
 * (es su trabajo), y las de los demás solo si caen en su alcance de área.
 *
 * Un borrador aparte: eso lo resuelve cada página, que siempre redirige al
 * autor del borrador.
 */
export function veLaRequisicion(
  sesion: AlcanceSesion,
  orden: { solicitanteId: number; dependencia: string | null },
): boolean {
  if (orden.solicitanteId === Number(sesion.id)) return true;
  if (veTodasLasAreas(sesion.rol)) return true;
  if (!puede(sesion.rol, "ordenes.verTodas")) return false;

  const area = areaDe(sesion);
  return area !== "" && area === normalizarDependencia(orden.dependencia);
}

/**
 * Motivo por el que ESTE usuario no puede autorizar ESTA requisición, o null
 * si puede. Solo el jefe inmediato está limitado por área: los demás roles
 * que autorizan (administrador y sub administrador) cubren cualquier gerencia.
 */
export function errorDeAutorizacion(
  sesion: AlcanceSesion,
  orden: { dependencia: string | null },
): string | null {
  if (sesion.rol !== "jefe_inmediato") return null;

  const area = areaDe(sesion);
  if (!area) {
    return (
      "Tu usuario todavía no tiene un área (gerencia) asignada. " +
      "Pídele al administrador que la asigne desde Usuarios para poder autorizar requisiciones."
    );
  }

  const dependencia = normalizarDependencia(orden.dependencia);
  if (dependencia === area) return null;

  return (
    `Solo puedes autorizar requisiciones de tu área (${textoDependencia(area)}). ` +
    `Esta requisición corresponde a ${dependencia ? textoDependencia(dependencia) : "otra dependencia"}.`
  );
}
