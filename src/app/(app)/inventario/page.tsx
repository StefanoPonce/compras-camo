import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, nombreRol } from "@/lib/permisos";
import FormularioDescargo from "./formulario-descargo";

function fechaHora(d: Date) {
  return new Date(d).toLocaleString("es-HN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default async function Inventario({ searchParams }: { searchParams: { material?: string; q?: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!puede(sesion?.user.rol, "inventario.descargar")) redirect("/");

  const q = searchParams.q || "";
  const materialInicial = searchParams.material ? Number(searchParams.material) : undefined;

  const [materiales, descargos] = await Promise.all([
    prisma.material.findMany({
      where: {
        activo: true,
        AND: [
          q
            ? {
                OR: [
                  { nombre: { contains: q, mode: "insensitive" } },
                  { codigo: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
        ],
      },
      orderBy: { codigo: "asc" },
    }),
    prisma.descargoInventario.findMany({
      include: { material: true, usuario: true },
      orderBy: { fecha: "desc" },
      take: 50,
    }),
  ]);

  const baja = (m: { existencia: number; minimo: number }) => m.existencia <= m.minimo;

  return (
    <>
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-sora font-semibold">Descargo de inventario</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[62ch]">
            Salida de productos de bodega: resta la existencia de un material y deja registrado quién lo hizo,
            cuánto se llevó y para qué.
          </p>
        </div>
      </div>

      <FormularioDescargo
        materiales={materiales.map((m) => ({
          id: m.id, codigo: m.codigo, nombre: m.nombre, unidad: m.unidad, existencia: m.existencia,
        }))}
        inicial={materialInicial}
      />

      <h3 className="text-base font-sora font-semibold mb-2.5">Existencias actuales</h3>
      <form className="flex gap-2 flex-wrap mb-4" action="/inventario">
        <input className="campo-input max-w-xs" type="search" name="q" placeholder="Buscar material o código" defaultValue={q} />
        <button className="btn-secundario">Filtrar</button>
      </form>

      {materiales.length ? (
        <div className="tarjeta overflow-x-auto mb-6">
          <table className="w-full tabla" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Material</th>
                <th>Unidad</th>
                <th className="text-right">Existencia</th>
                <th className="text-right">Mínimo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {materiales.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono">{m.codigo}</td>
                  <td><strong>{m.nombre}</strong><div className="text-xs text-tinta2">{m.categoria}</div></td>
                  <td>{m.unidad}</td>
                  <td className={"text-right" + (baja(m) ? " text-rojo font-semibold" : "")}>{m.existencia}</td>
                  <td className="text-right">{m.minimo}</td>
                  <td>
                    <span className={"etiqueta " + (baja(m) ? "et-rechazada" : "et-aprobada")}>
                      {baja(m) ? "Bajo el mínimo" : "Disponible"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2 mb-6">No hay materiales que coincidan con la búsqueda.</div>
      )}

      <h3 className="text-base font-sora font-semibold mb-2.5">Últimos descargos</h3>
      {descargos.length ? (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full tabla" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Material</th>
                <th className="text-right">Cantidad</th>
                <th className="text-right">Existencia</th>
                <th>Motivo</th>
                <th>Registró</th>
              </tr>
            </thead>
            <tbody>
              {descargos.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono whitespace-nowrap">{fechaHora(d.fecha)}</td>
                  <td>
                    {d.material.nombre}
                    <div className="text-xs text-tinta2 font-mono">{d.material.codigo}</div>
                  </td>
                  <td className="text-right text-rojo font-semibold">-{d.cantidad}</td>
                  <td className="text-right text-tinta2">
                    {d.existenciaAntes} → {d.existenciaDespues}
                  </td>
                  <td>{d.motivo}</td>
                  <td>
                    {d.usuario.nombre}
                    <div className="text-xs text-tinta2">{nombreRol(d.usuario.rol)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">
          Todavía no hay descargos registrados.
        </div>
      )}
    </>
  );
}
