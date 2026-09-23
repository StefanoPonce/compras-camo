import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede } from "@/lib/permisos";
import FormularioCrearMaterial from "./formulario-crear";
import BotonEliminarMaterial from "./boton-eliminar";
import ImagenMaterial from "../imagen-material";
import BotonExportarExcel from "../boton-exportar-excel";
import Link from "next/link";

function lps(n: number) {
  return "L " + n.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function Materiales({ searchParams }: { searchParams: { q?: string; cat?: string; fam?: string } }) {
  const sesion = await getServerSession(authOptions);
  const puedeGestionar = puede(sesion!.user.rol, "materiales.gestionar");
  const puedeDescargar = puede(sesion!.user.rol, "inventario.descargar");
  const q = searchParams.q || "";
  const cat = searchParams.cat || "";
  const fam = searchParams.fam || "";

  const [materiales, proveedores, categorias, familiasBrutas] = await Promise.all([
    prisma.material.findMany({
      where: {
        AND: [
          q ? { OR: [{ nombre: { contains: q, mode: "insensitive" } }, { codigo: { contains: q, mode: "insensitive" } }, { variante: { contains: q, mode: "insensitive" } }] } : {},
          cat ? { categoria: cat } : {},
          fam ? { familia: fam } : {},
        ],
      },
      include: { proveedor: true },
      orderBy: { codigo: "asc" },
    }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.material.findMany({ select: { categoria: true }, distinct: ["categoria"], orderBy: { categoria: "asc" } }),
    prisma.material.findMany({
      where: { familia: { not: null } },
      select: { familia: true },
      distinct: ["familia"],
      orderBy: { familia: "asc" },
    }),
  ]);
  const familias = familiasBrutas.map((f) => f.familia).filter((f): f is string => Boolean(f));

  return (
    <>
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-sora font-semibold">Materiales</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[62ch]">
            Catálogo de lo que la fundación compra, con la existencia actual y el mínimo que debe mantenerse en bodega.
            Los productos con la misma familia son variantes de un mismo artículo (distinto tamaño, volumen o presentación).
          </p>
        </div>
        <div className="ml-auto self-center">
          <BotonExportarExcel href="/materiales/exportar" />
        </div>
      </div>

      <form className="flex gap-2 flex-wrap mb-4" action="/materiales">
        <input className="campo-input max-w-xs" type="search" name="q" placeholder="Buscar material, código o variante" defaultValue={q} />
        <select className="campo-input max-w-[220px]" name="cat" defaultValue={cat}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.categoria} value={c.categoria}>{c.categoria}</option>)}
        </select>
        <select className="campo-input max-w-[220px]" name="fam" defaultValue={fam}>
          <option value="">Todas las familias</option>
          {familias.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button className="btn-secundario">Filtrar</button>
      </form>

      {puedeGestionar && <FormularioCrearMaterial proveedores={proveedores} familias={familias} />}

      {materiales.length ? (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full tabla" style={{ minWidth: 940 }}>
            <thead>
              <tr>
                <th>Imagen</th><th>Código</th><th>Material</th><th>Variante</th><th>Categoría</th>
                <th className="text-right">Existencia</th><th className="text-right">Mínimo</th>
                <th className="text-right">Último precio</th><th>Proveedor</th>
                {(puedeGestionar || puedeDescargar) && <th></th>}
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => {
                const bajo = m.existencia <= m.minimo;
                return (
                  <tr key={m.id}>
                    <td>
                      <ImagenMaterial src={m.imagenUrl} alt={m.nombre} className="h-12 w-12" />
                    </td>
                    <td className="font-mono">{m.codigo}</td>
                    <td><strong>{m.nombre}</strong><div className="text-xs text-tinta2">{m.unidad}</div></td>
                    <td>
                      {m.variante ? (
                        <>
                          <span className="etiqueta et-variante">{m.variante}</span>
                          {m.familia && <div className="text-xs text-tinta2 mt-1">{m.familia}</div>}
                        </>
                      ) : (
                        <span className="text-xs text-tinta2">{m.familia || "—"}</span>
                      )}
                    </td>
                    <td>{m.categoria}</td>
                    <td className={"text-right" + (bajo ? " text-rojo font-semibold" : "")}>{m.existencia}</td>
                    <td className="text-right">{m.minimo}</td>
                    <td className="text-right">{lps(Number(m.precioUltimo))}</td>
                    <td>{m.proveedor?.nombre || "—"}</td>
                    {(puedeGestionar || puedeDescargar) && (
                      <td className="whitespace-nowrap">
                        {puedeDescargar && (
                          <Link href={`/inventario?material=${m.id}`} className="btn-secundario btn-chico">Descargar</Link>
                        )}
                        {puedeGestionar && (
                          <>
                            <Link href={`/materiales/${m.id}/editar`} className="btn-secundario btn-chico">Editar</Link>{" "}
                            <BotonEliminarMaterial id={m.id} nombre={m.nombre} />
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">No hay materiales que coincidan con la búsqueda.</div>
      )}
    </>
  );
}
