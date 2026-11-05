import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  FILTROS_CONSOLIDACION,
  normalizarFiltroConsolidacion,
  obtenerConsolidacion,
} from "@/lib/consolidacion";
import { puede, puedeVerModulo } from "@/lib/permisos";
import { OPCIONES_GESTION } from "@/lib/estado-gestion";
import BotonExportarExcel from "../boton-exportar-excel";
import BotonImprimir from "../reportes/boton-imprimir";
import TablaConsolidacion from "./tabla-consolidacion";

function numero(n: number) {
  return n.toLocaleString("es-HN");
}

function Indicador({ valor, texto }: { valor: string | number; texto: string }) {
  return (
    <div className="tarjeta p-4">
      <div className="font-sora text-2xl font-semibold">{valor}</div>
      <div className="text-sm text-tinta2 mt-1">{texto}</div>
    </div>
  );
}

/** Vista de consolidación de compras. Es lo que se ve al entrar al módulo
 *  Gestión: los datos se muestran de una vez, sin menús intermedios. */
export default async function VistaConsolidacion({
  searchParams,
}: {
  searchParams: { estado?: string; q?: string };
}) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) redirect("/login");
  if (!puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "gestion")) redirect("/");
  if (!puede(sesion.user.rol, "consolidacion.ver")) redirect("/");

  const filtro = normalizarFiltroConsolidacion(searchParams.estado);
  const q = searchParams.q || "";
  const { ordenes, grupos } = await obtenerConsolidacion({ filtro, q });

  const totalRenglones = ordenes.reduce((suma, orden) => suma + orden.items.length, 0);
  const unidadesGeneral = grupos.reduce((suma, grupo) => suma + grupo.unidades, 0);
  const nombreFiltro = FILTROS_CONSOLIDACION.find((opcion) => opcion.valor === filtro)?.etiqueta || "Aprobadas";
  const generado = new Date().toLocaleString("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const exportarParams = new URLSearchParams({ estado: filtro });
  if (q.trim()) exportarParams.set("q", q.trim());
  const exportarHref = `/gestion/exportar?${exportarParams.toString()}`;

  return (
    <>
      <div className="solo-impresion mb-5">
        <div className="flex items-center gap-3 border-b border-borde pb-3">
          <Image src="/logo-camo.png" alt="Logo Fundación CAMO" width={52} height={52} />
          <div>
            <div className="font-sora font-semibold">Fundación CAMO</div>
            <h1 className="font-sora text-xl font-semibold">Consolidación de compras</h1>
            <div className="text-xs text-tinta2 mt-1">
              Requisiciones: {nombreFiltro} · Generado el {generado}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4 text-sm">
          <div><span className="text-tinta2">Requisiciones:</span> <strong>{ordenes.length}</strong></div>
          <div><span className="text-tinta2">Proveedores:</span> <strong>{grupos.length}</strong></div>
          <div><span className="text-tinta2">Renglones:</span> <strong>{totalRenglones}</strong></div>
          <div><span className="text-tinta2">Unidades consolidadas:</span> <strong>{numero(unidadesGeneral)}</strong></div>
        </div>
      </div>

      <div className="flex items-start gap-3 flex-wrap mb-4 no-imprimir">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-verde mb-1">Módulo de gestión</div>
          <h2 className="text-xl font-sora font-semibold">Consolidación de compras</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[68ch]">
            Reúne las requisiciones aprobadas por proveedor para revisar y preparar una compra consolidada. En la
            columna <strong className="text-tinta">Estado</strong> marcas cada material como{" "}
            <strong className="text-tinta">Gestionado</strong> o{" "}
            <strong className="text-tinta">Pendiente de Compra</strong>: lo que queda pendiente pasa al módulo
            Compras. Esta vista no modifica ni elimina las requisiciones originales.
          </p>
        </div>
        <div className="ml-auto self-center flex gap-2 flex-wrap">
          <BotonImprimir />
          <BotonExportarExcel href={exportarHref} texto="Exportar consolidado" />
        </div>
      </div>

      <form className="flex gap-2 flex-wrap items-center mb-6 no-imprimir" action="/gestion">
        <input
          className="campo-input max-w-xs"
          type="search"
          name="q"
          placeholder="Buscar folio, proveedor o material"
          defaultValue={q}
        />
        <input type="hidden" name="estado" value={filtro} />
        {q && <Link href={`/gestion?estado=${filtro}`} className="btn-secundario">Limpiar</Link>}
      </form>

      <div
        className="grid gap-3.5 mb-6 no-imprimir"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(175px,1fr))" }}
      >
        <Indicador valor={ordenes.length} texto="Requisiciones a consolidar" />
        <Indicador valor={numero(unidadesGeneral)} texto="Unidades consolidadas" />
      </div>

      <div className="tarjeta p-3.5 mb-4 text-sm text-tinta2 no-imprimir">
        <strong className="text-tinta">Cómo se consolida:</strong> se suman las cantidades del mismo material cuando
        existen en varias requisiciones del mismo proveedor, de modo que en una sola fila ves cuánto pedirle a ese
        proveedor.
      </div>

      {grupos.length ? (
        <TablaConsolidacion grupos={grupos} opciones={OPCIONES_GESTION} />
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">
          No hay requisiciones {filtro === "aprobadas" ? "aprobadas" : filtro === "pendientes" ? "pendientes" : "pendientes o aprobadas"} para consolidar con este filtro.
        </div>
      )}
    </>
  );
}
