import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { obtenerConsolidacion, type GrupoConsolidado } from "@/lib/consolidacion";
import { puede, puedeVerModulo } from "@/lib/permisos";
import {
  FILTROS_COMPRAS,
  OPCIONES_COMPRA,
  coincideFiltro,
  estadoDeFila,
  normalizarFiltroEstadoCompras,
} from "@/lib/estado-gestion";
import TablaConsolidacion from "../gestion/tabla-consolidacion";
import FiltroCategoria from "./filtro-categoria";

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

/** Módulo Compras: la continuación de Gestión. Trae las mismas requisiciones
 *  aprobadas, pero muestra los materiales que quedaron "Pendiente de Compra"
 *  (los gestionados ya no necesitan compra) y permite resolverlos como
 *  "Gestionado", que es lo que alimenta la requisición. */
export default async function Compras({
  searchParams,
}: {
  searchParams: { estado?: string; categoria?: string };
}) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) redirect("/login");
  if (!puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "compras")) redirect("/");
  if (!puede(sesion.user.rol, "compras.ver")) redirect("/");

  const filtro = normalizarFiltroEstadoCompras(searchParams.estado);
  const categoria = (searchParams.categoria || "").trim();

  const { grupos } = await obtenerConsolidacion({ filtro: "aprobadas" });

  // Categorías que aparecen en la consolidación: son las del filtro de arriba.
  const categorias = [...new Set(grupos.flatMap((g) => g.items.map((i) => i.material.categoria)))].sort(
    (a, b) => a.localeCompare(b),
  );

  // Se filtran los renglones; las requisiciones del encabezado de cada
  // proveedor quedan siendo solo las que aportan el material filtrado.
  const filtrados: GrupoConsolidado[] = [];
  for (const grupo of grupos) {
    const items = grupo.items.filter(
      (item) =>
        (!categoria || item.material.categoria === categoria) &&
        coincideFiltro(estadoDeFila(item.estados), filtro),
    );
    if (!items.length) continue;

    const idsVistos = new Set<number>();
    const ordenes = grupo.ordenes.filter((orden) => {
      const aporta = items.some((item) =>
        orden.items.some((renglon) => renglon.material.id === item.material.id),
      );
      if (!aporta || idsVistos.has(orden.id)) return false;
      idsVistos.add(orden.id);
      return true;
    });

    filtrados.push({
      ...grupo,
      items,
      ordenes,
      unidades: items.reduce((suma, item) => suma + item.cantidad, 0),
    });
  }

  const totalMateriales = filtrados.reduce((suma, grupo) => suma + grupo.items.length, 0);
  const unidades = filtrados.reduce((suma, grupo) => suma + grupo.unidades, 0);
  const enPendientes = filtro === "pendiente";
  const params = (valor: string) => {
    const p = new URLSearchParams();
    p.set("estado", valor);
    if (categoria) p.set("categoria", categoria);
    return `/compras?${p.toString()}`;
  };

  return (
    <>
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-verde mb-1">Módulo de compras</div>
          <h2 className="text-xl font-sora font-semibold">Compras</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[68ch]">
            Materiales de las requisiciones aprobadas que quedaron{" "}
            <strong className="text-tinta">Pendiente de Compra</strong> en Gestión. Cuando el material esté
            resuelto (compra directa, bodega, etc.), márcalo como{" "}
            <strong className="text-tinta">Gestionado</strong>: si la requisición ya no queda con nada
            pendiente, pasa sola a Recibida y el sub administrador registra la entrega para sumarla al inventario
            (solo lo Gestionado entra a bodega).
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center mb-4">
        {FILTROS_COMPRAS.map((opcion) => (
          <Link
            key={opcion.valor}
            href={params(opcion.valor)}
            className={"btn-chico " + (filtro === opcion.valor ? "btn" : "btn-secundario")}
          >
            {opcion.etiqueta}
          </Link>
        ))}
        <span className="ml-auto">
          <FiltroCategoria categorias={categorias} valor={categoria} />
        </span>
      </div>

      <div
        className="grid gap-3.5 mb-6"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(175px,1fr))" }}
      >
        <Indicador valor={totalMateriales} texto={enPendientes ? "Materiales por comprar" : "Materiales en la lista"} />
        <Indicador valor={numero(unidades)} texto="Unidades" />
      </div>

      {filtrados.length ? (
        <TablaConsolidacion grupos={filtrados} opciones={OPCIONES_COMPRA} />
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">
          {enPendientes
            ? "No hay materiales pendientes de compra con este filtro."
            : "No hay materiales con este filtro."}
        </div>
      )}
    </>
  );
}
