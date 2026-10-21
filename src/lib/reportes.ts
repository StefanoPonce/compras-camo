// Lógica de los reportes de /reportes.
//
// La página y la exportación a Excel usan estas mismas funciones para que los
// números de uno y otro nunca se contradigan: si se cambian las reglas de
// qué entra al reporte, cambian en los dos lados a la vez.

import type { Material } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { unidadesDe } from "@/lib/consolidacion";

export const ESTADOS_VALIDOS = ["Pendiente", "Aprobada", "Rechazada", "Recibida"] as const;

export type EstadoOrden = (typeof ESTADOS_VALIDOS)[number];

export type OrdenReporte = {
  id: number;
  folio: string;
  fecha: Date;
  estado: EstadoOrden;
  proveedorId: number | null;
  proveedor: { id: number; nombre: string } | null;
  items: { materialId: number; cantidad: number; unidad: string; material: Material }[];
};

export type FilaEstado = { estado: string; cant: number; unidades: number };
export type FilaProveedor = { nombre: string; ordenes: number; unidades: number; materiales: number };
export type FilaMaterial = {
  material: Material;
  cantidad: number;
  requisiciones: number;
  unidades: string;
};
export type FilaCategoria = { categoria: string; cantidad: number; materiales: number };

export type DatosReporte = {
  ordenes: OrdenReporte[];
  filasEstado: FilaEstado[];
  filasProveedor: FilaProveedor[];
  filasMaterial: FilaMaterial[];
  filasCategoria: FilaCategoria[];
  unidadesCompradas: number;
};

/** En los reportes el estado "Recibida" se muestra como "Entregada". */
export function nombreEstado(estado: string): string {
  return estado === "Recibida" ? "Entregada" : estado;
}

export function primerDiaDelMes(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Fecha corta para encabezados: "05 ene 2026". */
export function fecha(d: Date | string): string {
  return new Date(d).toLocaleDateString("es-HN", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Traduce el parámetro "estado" de la URL a los estados que entran al reporte.
 *
 *   "AR"      → aprobadas y entregadas (lo que se ve por omisión)
 *   "todas"   → todos los estados jugables
 *   un estado → solo ese estado
 *
 * El borrador nunca entra: es un trabajo a medias que todavía no se ha enviado.
 */
export function estadosDelFiltro(estadoParam: string | null | undefined): EstadoOrden[] {
  if (estadoParam === "AR") return ["Aprobada", "Recibida"];
  if ((ESTADOS_VALIDOS as readonly string[]).includes(estadoParam ?? "")) {
    return [estadoParam as EstadoOrden];
  }
  return [...ESTADOS_VALIDOS];
}

/** Etiqueta del filtro para ponerla en el título del reporte exportado. */
export function etiquetaFiltro(estadoParam: string | null | undefined): string {
  if (estadoParam === "AR") return "Aprobadas y entregadas";
  if (estadoParam === "todas") return "Todas las requisiciones";
  if ((ESTADOS_VALIDOS as readonly string[]).includes(estadoParam ?? "")) {
    return `Solo ${nombreEstado(estadoParam as string).toLowerCase()}`;
  }
  return "Todas las requisiciones";
}

/**
 * Arma el reporte: trae las órdenes del período y las agrupa por estado, por
 * proveedor, por material y por categoría.
 */
export async function obtenerReporte({
  desde,
  hasta,
  estado,
}: {
  desde: string;
  hasta: string;
  estado?: string | null;
}): Promise<DatosReporte> {
  const estados = estadosDelFiltro(estado);

  const ordenes = (await prisma.ordenCompra.findMany({
    where: {
      fecha: { gte: new Date(desde + "T00:00:00"), lte: new Date(hasta + "T23:59:59") },
      estado: { in: estados },
    },
    include: { proveedor: true, items: { include: { material: true } } },
    orderBy: { fecha: "asc" },
  })) as unknown as OrdenReporte[];

  // Unidades por estado: cada renglón aporta las unidades que pide la orden.
  const unidadesDeLaOrden = (o: OrdenReporte) => o.items.reduce((s, it) => s + it.cantidad, 0);

  const porEstado = new Map<string, { cant: number; unidades: number }>();
  for (const o of ordenes) {
    const actual = porEstado.get(o.estado) || { cant: 0, unidades: 0 };
    actual.cant += 1;
    actual.unidades += unidadesDeLaOrden(o);
    porEstado.set(o.estado, actual);
  }
  const filasEstado: FilaEstado[] = ESTADOS_VALIDOS.map((e) => {
    const v = porEstado.get(e) || { cant: 0, unidades: 0 };
    return { estado: nombreEstado(e), cant: v.cant, unidades: v.unidades };
  });

  // El proveedor es opcional, así que puede faltar. Esas requisiciones se
  // cuentan en su propia fila ("Sin proveedor") y no se pierden del reporte.
  const SIN_PROVEEDOR = 0;
  const porProveedor = new Map<number, { nombre: string; ordenes: number; unidades: number; materiales: Set<number> }>();
  for (const o of ordenes) {
    const clave = o.proveedorId ?? SIN_PROVEEDOR;
    const actual = porProveedor.get(clave) || {
      nombre: o.proveedor?.nombre ?? "Sin proveedor",
      ordenes: 0,
      unidades: 0,
      materiales: new Set<number>(),
    };
    actual.ordenes += 1;
    actual.unidades += unidadesDeLaOrden(o);
    for (const it of o.items) actual.materiales.add(it.materialId);
    porProveedor.set(clave, actual);
  }
  const filasProveedor: FilaProveedor[] = [...porProveedor.values()]
    .map((p) => ({ ...p, materiales: p.materiales.size }))
    .sort((a, b) => (a.nombre === "Sin proveedor" ? 1 : 0) - (b.nombre === "Sin proveedor" ? 1 : 0) || b.unidades - a.unidades);

  const porMaterial = new Map<number, { material: Material; cantidad: number; requisiciones: Set<number>; medidas: Set<string> }>();
  for (const o of ordenes) {
    for (const it of o.items) {
      const actual = porMaterial.get(it.materialId) || {
        material: it.material,
        cantidad: 0,
        requisiciones: new Set<number>(),
        medidas: new Set<string>(),
      };
      actual.cantidad += it.cantidad;
      actual.requisiciones.add(o.id);
      // La unidad es la del renglón, no la del catálogo.
      actual.medidas.add(it.unidad || it.material.unidad);
      porMaterial.set(it.materialId, actual);
    }
  }
  const filasMaterial: FilaMaterial[] = [...porMaterial.values()]
    .map((m) => ({ ...m, requisiciones: m.requisiciones.size, unidades: unidadesDe(m.medidas) }))
    .sort((a, b) => b.cantidad - a.cantidad);
  const unidadesCompradas = filasMaterial.reduce((s, m) => s + m.cantidad, 0);

  const porCategoria = new Map<string, { cantidad: number; materiales: Set<number> }>();
  for (const o of ordenes) {
    for (const it of o.items) {
      const cat = it.material.categoria;
      const actual = porCategoria.get(cat) || { cantidad: 0, materiales: new Set<number>() };
      actual.cantidad += it.cantidad;
      actual.materiales.add(it.materialId);
      porCategoria.set(cat, actual);
    }
  }
  const filasCategoria: FilaCategoria[] = [...porCategoria.entries()]
    .map(([categoria, v]) => ({ categoria, cantidad: v.cantidad, materiales: v.materiales.size }))
    .sort((a, b) => b.cantidad - a.cantidad);

  return { ordenes, filasEstado, filasProveedor, filasMaterial, filasCategoria, unidadesCompradas };
}
