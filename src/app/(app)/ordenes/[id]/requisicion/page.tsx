import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ImagenLogo from "./imagen-logo";
import BotonImprimirRequisicion from "./boton-imprimir";

function fecha(d: Date) {
  return new Date(d).toLocaleDateString("es-HN", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function Requisicion({ params }: { params: { id: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) redirect("/login");

  const o = await prisma.ordenCompra.findUniqueOrThrow({
    where: { id: Number(params.id) },
    include: {
      proveedor: true,
      solicitante: true,
      revisor: true,
      items: { include: { material: true }, orderBy: { id: "asc" } },
    },
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-end mb-4 no-imprimir">
        <BotonImprimirRequisicion />
      </div>

      {/* A partir de aquí, todo está pensado para verse igual en pantalla
          y al imprimir — imita la hoja física de requisición. */}
      <div className="tarjeta p-8">
        <div className="text-center mb-6">
          <ImagenLogo />
          <h1 className="font-sora text-xl font-semibold">Fundación CAMO - Honduras</h1>
          <p className="text-sm mt-3">Área de Administración</p>
          <p className="text-sm font-medium">Requisición de Materiales</p>
        </div>

        <table className="w-full text-sm mb-5">
          <tbody>
            <tr>
              <td className="py-1 pr-2 font-medium whitespace-nowrap">Dependencia:</td>
              <td className="py-1 border-b border-tinta">{o.dependencia || "—"}</td>
            </tr>
            <tr>
              <td className="py-1 pr-2 font-medium whitespace-nowrap">Lugar:</td>
              <td className="py-1 border-b border-tinta">{o.lugar || "—"}</td>
              <td className="py-1 pl-4 pr-2 font-medium whitespace-nowrap">Fecha:</td>
              <td className="py-1 border-b border-tinta">{fecha(o.fecha)}</td>
            </tr>
            <tr>
              <td className="py-1 pr-2 font-medium whitespace-nowrap">Folio:</td>
              <td className="py-1 border-b border-tinta font-mono">{o.folio}</td>
              <td className="py-1 pl-4 pr-2 font-medium whitespace-nowrap">Proveedor:</td>
              <td className="py-1 border-b border-tinta">{o.proveedor.nombre}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-sm mb-2">Lista de Materiales, Suministros, Equipo Médico, Útiles de oficina u otros solicitados:</p>

        <table className="w-full text-sm border border-tinta mb-4" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th className="border border-tinta px-2 py-1 w-10">No.</th>
              <th className="border border-tinta px-2 py-1 text-left">Descripción del Artículo</th>
              <th className="border border-tinta px-2 py-1 w-24">Código</th>
              <th className="border border-tinta px-2 py-1 w-24">Unidad</th>
              <th className="border border-tinta px-2 py-1 w-24">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((it, i) => (
              <tr key={it.id}>
                <td className="border border-tinta px-2 py-1 text-center">{i + 1}</td>
                <td className="border border-tinta px-2 py-1">{it.material.nombre}</td>
                <td className="border border-tinta px-2 py-1 text-center font-mono">{it.material.codigo}</td>
                <td className="border border-tinta px-2 py-1 text-center">{it.material.unidad}</td>
                <td className="border border-tinta px-2 py-1 text-center">{it.cantidad}</td>
              </tr>
            ))}
            {/* filas vacías para completar la hoja, como en el formato físico */}
            {Array.from({ length: Math.max(0, 4 - o.items.length) }).map((_, i) => (
              <tr key={"vacia" + i}>
                <td className="border border-tinta px-2 py-3">&nbsp;</td>
                <td className="border border-tinta px-2 py-3"></td>
                <td className="border border-tinta px-2 py-3"></td>
                <td className="border border-tinta px-2 py-3"></td>
                <td className="border border-tinta px-2 py-3"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border border-tinta p-2.5 mb-8 min-h-[52px]">
          <p className="text-xs font-medium mb-1">Observaciones:</p>
          <p className="text-sm">{o.justificacion}</p>
        </div>

        <div className="grid grid-cols-2 border border-tinta text-sm">
          <div className="border-r border-b border-tinta p-2.5">
            <p>Solicitado por:</p>
            <p className="mt-3">Nombre: <span className="font-medium">{o.solicitante.nombre}</span></p>
            <p className="mt-4">Firma: ______________________________</p>
          </div>
          <div className="border-b border-tinta p-2.5">
            <p>Aprobado por:</p>
            <p className="mt-3">Nombre: <span className="font-medium">{o.revisor?.nombre || ""}</span></p>
            <p className="mt-4">Firma: ______________________________</p>
          </div>
          <div className="border-r border-tinta p-2.5">
            <p>Entregado por:</p>
            <p className="mt-3">Cargo: ______________________________</p>
            <p className="mt-4">Firma: ______________________________</p>
          </div>
          <div className="p-2.5">
            <p>Recibí por:</p>
            <p className="mt-3">Firma: ______________________________</p>
            <p className="mt-4">Fecha: ______________________________</p>
          </div>
        </div>
      </div>
    </div>
  );
}
