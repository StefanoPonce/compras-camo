import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo, inventarioPropio } from "@/lib/permisos";
import { materialesSolicitadosPor } from "@/lib/materiales-solicitados";
import FormularioCrearMaterial from "./formulario-crear";
import BotonEliminarMaterial from "./boton-eliminar";
import ImagenMaterial from "../imagen-material";
import BotonExportarExcel from "../boton-exportar-excel";
import BotonExportarPdf from "../boton-exportar-pdf";
import BotonPdf from "../boton-pdf";
import EncabezadoImpresion from "../encabezado-impresion";
import { describirFiltrosMateriales, normalizarFiltrosMateriales, paramsMateriales, whereMateriales } from "@/lib/materiales-filtros";
import Link from "next/link";

export default async function Materiales({
  searchParams,
}: {
  searchParams: { q?: string; cat?: string; ex?: string };
}) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "materiales")) redirect("/");
  const puedeGestionar = puede(sesion.user.rol, "materiales.gestionar");
  const puedeDescargar =
    puede(sesion.user.rol, "inventario.descargar") &&
    puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "inventario");

  // El catálogo lo ven todos igual, pero el atajo "Descargar" solo apunta a
  // materiales que este usuario realmente puede descargar: para el
  // responsable de solicitar son los de sus propias requisiciones (lo pedido y
  // lo recibido), tal como los lista /inventario.
  const propios = inventarioPropio(sesion.user.rol)
    ? await materialesSolicitadosPor(Number(sesion.user.id))
    : null;
  const puedeDescargarDe = (materialId: number) => puedeDescargar && (!propios || propios.includes(materialId));
  const veAtajoDescargo = puedeDescargar && (!propios || propios.length > 0);

  const filtros = normalizarFiltrosMateriales(searchParams);
  const { q, cat, ex } = filtros;

  const [materiales, proveedores, categorias] = await Promise.all([
    prisma.material.findMany({
      where: whereMateriales(filtros),
      include: { proveedor: true },
      orderBy: { codigo: "asc" },
    }),
    prisma.proveedor.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.material.findMany({ select: { categoria: true }, distinct: ["categoria"], orderBy: { categoria: "asc" } }),
  ]);

  // Lo que va impreso arriba de la tabla, para que el PDF diga con qué filtros
  // se sacó el listado.
  const filtrosImpresion = describirFiltrosMateriales(filtros);
  const queryExportar = paramsMateriales(filtros).toString();
  const sufijoExportar = queryExportar ? `?${queryExportar}` : "";

  return (
    <>
      <EncabezadoImpresion
        titulo="Listado de materiales"
        descripcion={`${materiales.length} material(es) del catálogo`}
        filtros={filtrosImpresion}
        usuario={sesion.user.name || sesion.user.usuario}
      />

      <div className="flex items-start gap-3 flex-wrap mb-4 no-imprimir">
        <div>
          <h2 className="text-xl font-sora font-semibold">Materiales</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[62ch]">
            Catálogo de lo que la fundación compra, con la existencia actual y el mínimo que debe mantenerse en bodega.
            El nombre del material lleva la presentación completa (por ejemplo AGUA 12 ONZ o BOLSA PLASTICA 4X8).
          </p>
        </div>
        <div className="ml-auto self-center flex gap-2 flex-wrap">
          <BotonExportarExcel href={`/materiales/exportar${sufijoExportar}`} />
          <BotonExportarPdf href={`/materiales/exportar-pdf${sufijoExportar}`} />
          <BotonPdf texto="Imprimir" />
        </div>
      </div>

      <form className="flex gap-2 flex-wrap mb-4 no-imprimir" action="/materiales">
        <input className="campo-input max-w-xs" type="search" name="q" placeholder="Buscar material o código" defaultValue={q} />
        <select className="campo-input max-w-[220px]" name="cat" defaultValue={cat}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.categoria} value={c.categoria}>{c.categoria}</option>)}
        </select>
        <select className="campo-input max-w-[220px]" name="ex" defaultValue={ex}>
          <option value="">Todos los materiales</option>
          <option value="con">Con existencia</option>
          <option value="sin">Sin existencia</option>
        </select>
        <button className="btn-secundario">Filtrar</button>
      </form>

      {puedeGestionar && (
        <div className="no-imprimir">
          <FormularioCrearMaterial proveedores={proveedores} categorias={categorias.map((c) => c.categoria)} />
        </div>
      )}

      {materiales.length ? (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full tabla tabla-listado table-fixed" style={{ minWidth: 990 }}>
            <colgroup>
              <col style={{ width: 76 }} />
              <col style={{ width: 84 }} />
              <col style={{ width: 240 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 170 }} />
              {(puedeGestionar || veAtajoDescargo) && <col style={{ width: 215 }} />}
            </colgroup>
            <thead>
              <tr>
                <th>Imagen</th><th>Código</th><th>Material</th><th>Categoría</th>
                <th className="text-right">Existencia</th><th className="text-right">Mínimo</th>
                <th>Proveedor</th>
                {(puedeGestionar || veAtajoDescargo) && <th className="no-imprimir col-acciones"></th>}
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
                    <td className="break-words"><strong>{m.nombre}</strong><div className="text-xs text-tinta2">{m.unidad}</div></td>
                    <td className="break-words">{m.categoria}</td>
                    <td className={"text-right" + (bajo ? " text-rojo font-semibold" : "")}>{m.existencia}</td>
                    <td className="text-right">{m.minimo}</td>
                    <td className="break-words">{m.proveedor?.nombre || "—"}</td>
                    {(puedeGestionar || veAtajoDescargo) && (
                      <td className="whitespace-nowrap no-imprimir col-acciones">
                        {puedeDescargarDe(m.id) && (
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
