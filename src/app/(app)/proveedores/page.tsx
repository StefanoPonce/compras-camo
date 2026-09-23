import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede } from "@/lib/permisos";
import FormularioCrearProveedor from "./formulario-crear";
import BotonEliminarProveedor from "./boton-eliminar";

export default async function Proveedores({ searchParams }: { searchParams: { q?: string } }) {
  const sesion = await getServerSession(authOptions);
  const puedeGestionar = puede(sesion!.user.rol, "proveedores.gestionar");
  const q = searchParams.q || "";

  const proveedores = await prisma.proveedor.findMany({
    where: q
      ? { OR: [
          { nombre: { contains: q, mode: "insensitive" } },
          { codigo: { contains: q, mode: "insensitive" } },
          { contacto: { contains: q, mode: "insensitive" } },
          { rtn: { contains: q, mode: "insensitive" } },
          { tipoProducto: { contains: q, mode: "insensitive" } },
        ] }
      : {},
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-sora font-semibold">Proveedores</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[62ch]">
            {puedeGestionar
              ? "Registro de las empresas a las que la fundación compra."
              : "Consulta los datos de contacto de cada proveedor."}
          </p>
        </div>
      </div>

      <form className="mb-4" action="/proveedores">
        <input className="campo-input max-w-xs" type="search" name="q" placeholder="Buscar por código, nombre, contacto o RTN" defaultValue={q} />
      </form>

      {puedeGestionar && <FormularioCrearProveedor />}

      {proveedores.length ? (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full tabla" style={{ minWidth: 840 }}>
            <thead>
              <tr>
                <th>Código</th><th>Proveedor</th><th>Tipo de producto</th><th>Contacto</th>
                <th>Teléfono</th><th>RTN</th><th>Estado</th>{puedeGestionar && <th></th>}
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono">{p.codigo}</td>
                  <td><strong>{p.nombre}</strong><div className="text-xs text-tinta2">{p.direccion}</div></td>
                  <td>{p.tipoProducto || <span className="text-xs text-tinta2">—</span>}</td>
                  <td>{p.contacto}<div className="text-xs text-tinta2">{p.correo}</div></td>
                  <td>{p.telefono}</td>
                  <td className="font-mono">{p.rtn}</td>
                  <td><span className={"etiqueta " + (p.activo ? "et-aprobada" : "et-rechazada")}>{p.activo ? "Activo" : "Inactivo"}</span></td>
                  {puedeGestionar && (
                    <td className="whitespace-nowrap">
                      <Link href={`/proveedores/${p.id}/editar`} className="btn-secundario btn-chico">Editar</Link>{" "}
                      <BotonEliminarProveedor id={p.id} nombre={p.nombre} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">No se encontraron proveedores.</div>
      )}
    </>
  );
}
