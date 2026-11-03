import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo } from "@/lib/permisos";
import FormularioCrearProveedor from "./formulario-crear";
import BotonEliminarProveedor from "./boton-eliminar";
import BotonExportarExcel from "../boton-exportar-excel";
import BotonExportarPdf from "../boton-exportar-pdf";
import BotonPdf from "../boton-pdf";
import EncabezadoImpresion from "../encabezado-impresion";

export default async function Proveedores({ searchParams }: { searchParams: { q?: string; estado?: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "proveedores")) redirect("/");
  const puedeGestionar = puede(sesion.user.rol, "proveedores.gestionar");
  const q = searchParams.q || "";
  // Filtro de estado: "1" solo activos, "0" solo inactivos, "" todos. Solo se
  // aceptan esos dos valores para no dejar que un parametro raro se vaya al WHERE.
  const estado = searchParams.estado === "1" || searchParams.estado === "0" ? searchParams.estado : "";

  const proveedores = await prisma.proveedor.findMany({
    where: {
      ...(estado ? { activo: estado === "1" } : {}),
      ...(q
        ? { OR: [
            { nombre: { contains: q, mode: "insensitive" } },
            { codigo: { contains: q, mode: "insensitive" } },
            { contacto: { contains: q, mode: "insensitive" } },
            { rtn: { contains: q, mode: "insensitive" } },
            { tipoProducto: { contains: q, mode: "insensitive" } },
            { cuentaBancaria: { contains: q, mode: "insensitive" } },
          ] }
        : {}),
    },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <EncabezadoImpresion
        titulo="Listado de proveedores"
        descripcion={`${proveedores.length} proveedor(es) registrado(s)`}
        filtros={[q ? `Búsqueda: "${q}"` : "", estado === "1" ? "Solo activos" : estado === "0" ? "Solo inactivos" : ""].filter(Boolean).join(" · ")}
        usuario={sesion.user.name || sesion.user.usuario}
      />

      <div className="flex items-start gap-3 flex-wrap mb-4 no-imprimir">
        <div>
          <h2 className="text-xl font-sora font-semibold">Proveedores</h2>
          <p className="text-tinta2 text-sm mt-1 max-w-[62ch]">
            {puedeGestionar
              ? "Registro de las empresas a las que la fundación compra."
              : "Consulta los datos de contacto de cada proveedor."}
          </p>
        </div>
        <div className="ml-auto self-center flex gap-2 flex-wrap">
          <BotonExportarExcel href="/proveedores/exportar" />
          <BotonExportarPdf href="/proveedores/exportar-pdf" />
          <BotonPdf texto="Imprimir" />
        </div>
      </div>

      <form className="flex gap-2 flex-wrap mb-4 no-imprimir" action="/proveedores">
        <input className="campo-input max-w-xs" type="search" name="q" placeholder="Buscar por código, nombre, contacto o RTN" defaultValue={q} />
        <select className="campo-input max-w-[200px]" name="estado" defaultValue={estado}>
          <option value="">Todos los estados</option>
          <option value="1">Solo activos</option>
          <option value="0">Solo inactivos</option>
        </select>
        <button className="btn-secundario">Filtrar</button>
      </form>

      {puedeGestionar && <div className="no-imprimir"><FormularioCrearProveedor /></div>}

      {proveedores.length ? (
        <div className="tarjeta overflow-x-auto">
          {/* Anchos fijos por columna: así cada dato entra en su espacio y la
              tabla no se alarga por culpa de un correo o una dirección larga.
              La última columna (acciones) se dibuja pegada al borde derecho. */}
          <table className="w-full tabla tabla-listado table-fixed" style={{ minWidth: 1010 }}>
            <colgroup>
              <col style={{ width: 84 }} />
              <col style={{ width: 174 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 146 }} />
              <col style={{ width: 94 }} />
              {puedeGestionar && <col style={{ width: 160 }} />}
            </colgroup>
            <thead>
              <tr>
                <th>Código</th><th>Proveedor</th><th>Tipo de producto</th><th>Contacto</th>
                <th>Teléfono</th><th>RTN</th><th>Cuenta bancaria</th><th>Estado</th>
                {puedeGestionar && <th className="no-imprimir col-acciones"></th>}
              </tr>
            </thead>
            <tbody>
              {proveedores.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono">{p.codigo}</td>
                  <td><strong>{p.nombre}</strong><div className="text-xs text-tinta2 break-words">{p.direccion}</div></td>
                  <td className="break-words">{p.tipoProducto || <span className="text-xs text-tinta2">—</span>}</td>
                  {/* Correo y teléfono no tienen espacios: si no se les permite
                      cortar, empujan la tabla y los botones quedan fuera de
                      pantalla. Con "anywhere" solo se parten cuando no caben. */}
                  <td className="break-words">{p.contacto}<div className="text-xs text-tinta2 [overflow-wrap:anywhere]">{p.correo}</div></td>
                  <td className="[overflow-wrap:anywhere]">{p.telefono}</td>
                  <td className="font-mono [overflow-wrap:anywhere]">{p.rtn}</td>
                  <td className="font-mono [overflow-wrap:anywhere]">{p.cuentaBancaria || <span className="text-xs text-tinta2">—</span>}</td>
                  <td><span className={"etiqueta " + (p.activo ? "et-aprobada" : "et-rechazada")}>{p.activo ? "Activo" : "Inactivo"}</span></td>
                  {puedeGestionar && (
                    <td className="whitespace-nowrap no-imprimir col-acciones">
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
