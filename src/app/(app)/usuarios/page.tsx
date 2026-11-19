import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puede, puedeVerModulo, nombreRol, claseRol, normalizarModulos, MODULOS } from "@/lib/permisos";
import { esDependenciaValida, textoDependencia, SIN_AREA_ASIGNADA } from "@/lib/dependencias";
import FormularioCrearUsuario from "./formulario-crear";
import FiltroGerencia from "./filtro-gerencia";
import BotonAlternarUsuario from "./boton-alternar";
import BotonEliminarUsuario from "./boton-eliminar";

export default async function Usuarios({ searchParams }: { searchParams: { area?: string } }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "usuarios")) redirect("/");
  // Todo lo de este módulo (y por lo tanto el filtro de gerencias de abajo)
  // es exclusivo del administrador del sistema.
  if (!puede(sesion.user.rol, "usuarios.gestionar")) redirect("/");

  // Filtro por gerencia: `?area=gerente mercadeo` muestra solo esa gerencia y
  // `?area=sin-area` las cuentas que todavía no tienen una. Un valor raro (que
  // no venga del catálogo) se ignora y se muestra la lista completa.
  const filtroArea = String(searchParams.area || "").trim();
  const esSinArea = filtroArea === SIN_AREA_ASIGNADA;
  const enCatalogo = filtroArea !== "" && esDependenciaValida(filtroArea);
  const filtroActivo = esSinArea || enCatalogo;
  const donde = filtroActivo ? (esSinArea ? { area: null } : { area: filtroArea }) : {};

  const [usuarios, total] = await Promise.all([
    prisma.usuario.findMany({
      where: donde,
      include: { _count: { select: { movimientos: true } } },
      orderBy: { nombre: "asc" },
    }),
    prisma.usuario.count(),
  ]);

  // Qué dice el contador de al lado del filtro.
  const descripcionFiltro = !filtroActivo
    ? `Viendo los ${usuarios.length} usuario(s) del sistema. Usa el filtro para ver quién pertenece a cada gerencia.`
    : esSinArea
      ? `${usuarios.length} de ${total} usuario(s) sin gerencia asignada.`
      : `${usuarios.length} de ${total} usuario(s) en ${textoDependencia(filtroArea)}.`;

  return (
    <>
      <h2 className="text-xl font-sora font-semibold">Usuarios</h2>
      <p className="text-tinta2 text-sm mt-1 mb-4 max-w-[62ch]">
        Quién puede entrar al sistema y con qué permisos. Solo el administrador crea usuarios, da permisos y
        resetea contraseñas; en el panel de cada usuario también puede decidir qué módulos verá y a qué
        gerencia (área) pertenece, que es lo que define qué requisiciones ve y cuáles autoriza.
      </p>

      <FormularioCrearUsuario />

      {/* Filtro por gerencia: solo aparece aquí, en el módulo que abre el
          administrador, para agrupar a las personas por gerencia sin tener
          que recorrer toda la lista. */}
      <div className="flex items-end gap-3 flex-wrap mb-4">
        <div>
          <label htmlFor="filtro-gerencia" className="block text-xs text-tinta2 mb-1 font-medium">
            Gerencia
          </label>
          <FiltroGerencia valor={filtroActivo ? filtroArea : ""} />
        </div>
        <p className="text-xs text-tinta2 mb-2">{descripcionFiltro}</p>
        {filtroActivo && (
          <Link href="/usuarios" className="btn-secundario btn-chico mb-1">
            Quitar filtro
          </Link>
        )}
      </div>

      {usuarios.length === 0 ? (
        <div className="tarjeta p-10 text-center text-tinta2">
          {esSinArea
            ? "Todas las cuentas ya tienen gerencia asignada."
            : `No hay usuarios en ${textoDependencia(filtroArea)}.`}
        </div>
      ) : (
      <div className="tarjeta overflow-x-auto">
        <table className="w-full tabla" style={{ minWidth: 860 }}>
          <thead><tr><th>Nombre</th><th>Cuenta</th><th>Rol</th><th>Gerencia</th><th>Módulos</th><th>Estado</th><th className="text-right">Movimientos</th><th></th></tr></thead>
          <tbody>
            {usuarios.map((u) => {
              const modulos = normalizarModulos(u.modulosPermitidos, u.rol);
              return (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong></td>
                  <td className="font-mono">{u.usuario}</td>
                  <td><span className={"etiqueta " + claseRol(u.rol)}>{nombreRol(u.rol)}</span></td>
                  {/* La gerencia de la persona: de aquí salen las requisiciones
                      que ve y, si es jefe, las que puede autorizar. */}
                  <td className="whitespace-nowrap">{textoDependencia(u.area) || <span className="text-xs text-tinta2">sin asignar</span>}</td>
                  <td>
                    <span className="etiqueta et-variante">
                      {modulos.length === MODULOS.length ? "Todos" : `${modulos.length} módulos`}
                    </span>
                  </td>
                  <td><span className={"etiqueta " + (u.activo ? "et-aprobada" : "et-rechazada")}>{u.activo ? "Activo" : "Desactivado"}</span></td>
                  <td className="text-right">{u._count.movimientos}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/usuarios/${u.id}/editar`} className="btn-secundario btn-chico">Editar</Link>{" "}
                    {String(u.id) !== sesion.user.id && (
                      <>
                        <BotonAlternarUsuario id={u.id} activo={u.activo} />{" "}
                        <BotonEliminarUsuario id={u.id} nombre={u.nombre} />
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </>
  );
}
