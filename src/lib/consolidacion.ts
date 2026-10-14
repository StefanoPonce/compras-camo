import { prisma } from "@/lib/prisma";
import type { Prisma, Material, Proveedor } from "@prisma/client";
import { etiquetaUnidad } from "@/lib/unidades";

/** "CAJA" o, si el mismo material se pidió de varias formas, "CAJA / ROLLO". */
export function unidadesDe(unidades: Set<string>): string {
  const lista = [...unidades];
  return lista.length ? lista.map(etiquetaUnidad).join(" / ") : "—";
}

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
  folios: Set<string>;
  /** Unidades en las que se pidió este material. Casi siempre es una sola;
   *  si el mismo material se pidió de dos formas, se muestran todas. */
  unidades: Set<string>;
};

export type GrupoConsolidado = {
  /** Null cuando ningún renglón de la group's requisición trae proveedor. El
   *  proveedor es opcional, así que estos materiales se agrupan aparte en vez
   *  de desaparecer de la consolidación. */
  proveedor: Proveedor | null;
  ordenes: OrdenConsolidacion[];
  items: ItemConsolidado[];
  unidades: number;
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
  // Clave 0 para "sin proveedor". Ningún proveedor real tiene id 0, así que no
  // choca con ninguno y esos renglones no se pierden.
  const SIN_PROVEEDOR = 0;
  const porProveedor = new Map<
    number,
    {
      proveedor: Proveedor | null;
      ordenes: Map<number, OrdenConsolidacion>;
      items: Map<number, ItemConsolidado>;
    }
  >();

  for (const orden of ordenes) {
    for (const item of orden.items) {
      // El proveedor del renglón manda; las órdenes antiguas pueden no tenerlo
      // guardado y deben seguir agrupándose por el proveedor general.
      const proveedor = item.proveedor ?? orden.proveedor;
      const clave = proveedor?.id ?? SIN_PROVEEDOR;
      let grupo = porProveedor.get(clave);

      if (!grupo) {
        grupo = {
          proveedor,
          ordenes: new Map(),
          items: new Map(),
        };
        porProveedor.set(clave, grupo);
      }

      grupo.ordenes.set(orden.id, orden);
      const material = item.material;
      const actual = grupo.items.get(material.id) || {
        material,
        cantidad: 0,
        folios: new Set<string>(),
        unidades: new Set<string>(),
      };
      actual.cantidad += item.cantidad;
      actual.folios.add(orden.folio);
      // La unidad es la del renglón, no la del catálogo: el solicitante pudo
      // pedirlo en una medida distinta a la que tiene registrada.
      actual.unidades.add(item.unidad || material.unidad);
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
        unidades: items.reduce((suma, item) => suma + item.cantidad, 0),
      };
    })
    // El grupo "Sin proveedor" va al final: son requisiciones a las que todavía hay
    // que asignarle proveedor, no algo que se pueda comprar ya.
    .sort(
      (a, b) =>
        (a.proveedor ? 0 : 1) - (b.proveedor ? 0 : 1) ||
        b.unidades - a.unidades ||
        (a.proveedor?.nombre ?? "").localeCompare(b.proveedor?.nombre ?? "")
    );
}
