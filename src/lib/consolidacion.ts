import { prisma } from "@/lib/prisma";
import type { Prisma, Material, Proveedor } from "@prisma/client";

export type FiltroConsolidacion = "aprobadas" | "pendientes" | "abiertas";

export type OrdenConsolidacion = Prisma.OrdenCompraGetPayload<{
  include: {
    proveedor: true;
    solicitante: true;
    items: { include: { material: true; proveedor: true } };
  };
}>;

type ItemConsolidado = {
  material: Material;
  cantidad: number;
  total: number;
  folios: Set<string>;
};

export type GrupoConsolidado = {
  proveedor: Proveedor;
  ordenes: OrdenConsolidacion[];
  items: ItemConsolidado[];
  total: number;
};

export const FILTROS_CONSOLIDACION: { valor: FiltroConsolidacion; etiqueta: string }[] = [
  { valor: "aprobadas", etiqueta: "Aprobadas" },
  { valor: "pendientes", etiqueta: "Pendientes" },
  { valor: "abiertas", etiqueta: "Pendientes y aprobadas" },
];

export function normalizarFiltroConsolidacion(valor?: string): FiltroConsolidacion {
  return valor === "pendientes" || valor === "abiertas" ? valor : "aprobadas";
}

function estadosDelFiltro(filtro: FiltroConsolidacion): ("Pendiente" | "Aprobada")[] {
  if (filtro === "pendientes") return ["Pendiente"];
  if (filtro === "abiertas") return ["Pendiente", "Aprobada"];
  return ["Aprobada"];
}

export async function obtenerConsolidacion({
  filtro,
  q,
}: {
  filtro: FiltroConsolidacion;
  q?: string;
}): Promise<{ ordenes: OrdenConsolidacion[]; grupos: GrupoConsolidado[] }> {
  const busqueda = q?.trim() || "";
  const ordenes = await prisma.ordenCompra.findMany({
    where: {
      estado: { in: estadosDelFiltro(filtro) },
      ...(busqueda
        ? {
            OR: [
              { folio: { contains: busqueda, mode: "insensitive" } },
              { proveedor: { nombre: { contains: busqueda, mode: "insensitive" } } },
              { solicitante: { nombre: { contains: busqueda, mode: "insensitive" } } },
              {
                items: {
                  some: {
                    material: {
                      OR: [
                        { codigo: { contains: busqueda, mode: "insensitive" } },
                        { nombre: { contains: busqueda, mode: "insensitive" } },
                        { variante: { contains: busqueda, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      proveedor: true,
      solicitante: true,
      items: { include: { material: true, proveedor: true } },
    },
    orderBy: [{ fecha: "asc" }, { folio: "asc" }],
  });

  return { ordenes, grupos: agruparConsolidacion(ordenes) };
}

export function agruparConsolidacion(ordenes: OrdenConsolidacion[]): GrupoConsolidado[] {
  const porProveedor = new Map<
    number,
    {
      proveedor: Proveedor;
      ordenes: Map<number, OrdenConsolidacion>;
      items: Map<number, ItemConsolidado>;
    }
  >();

  for (const orden of ordenes) {
    for (const item of orden.items) {
      // El proveedor del renglón manda; las órdenes antiguas pueden no tenerlo
      // guardado y deben seguir agrupándose por el proveedor general.
      const proveedor = item.proveedor ?? orden.proveedor;
      let grupo = porProveedor.get(proveedor.id);

      if (!grupo) {
        grupo = {
          proveedor,
          ordenes: new Map(),
          items: new Map(),
        };
        porProveedor.set(proveedor.id, grupo);
      }

      grupo.ordenes.set(orden.id, orden);
      const material = item.material;
      const actual = grupo.items.get(material.id) || {
        material,
        cantidad: 0,
        total: 0,
        folios: new Set<string>(),
      };
      actual.cantidad += item.cantidad;
      actual.total += item.cantidad * Number(item.precio);
      actual.folios.add(orden.folio);
      grupo.items.set(material.id, actual);
    }
  }

  return [...porProveedor.values()]
    .map((grupo) => {
      const items = [...grupo.items.values()].sort((a, b) => a.material.codigo.localeCompare(b.material.codigo));
      return {
        proveedor: grupo.proveedor,
        ordenes: [...grupo.ordenes.values()].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()),
        items,
        total: items.reduce((suma, item) => suma + item.total, 0),
      };
    })
    .sort((a, b) => b.total - a.total || a.proveedor.nombre.localeCompare(b.proveedor.nombre));
}
