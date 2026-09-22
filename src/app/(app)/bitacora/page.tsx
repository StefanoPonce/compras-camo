import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function fechaHora(d: Date) {
  return new Date(d).toLocaleString("es-HN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function Bitacora({ searchParams }: { searchParams: { usuario?: string; modulo?: string; q?: string } }) {
  const sesion = await getServerSession(authOptions);
  if (sesion?.user.rol !== "administrador") redirect("/");

  const usuarioId = searchParams.usuario ? Number(searchParams.usuario) : undefined;
  const modulo = searchParams.modulo || undefined;
  const q = searchParams.q || "";

  const [movimientos, usuarios, modulos] = await Promise.all([
    prisma.movimiento.findMany({
      where: {
        ...(usuarioId ? { usuarioId } : {}),
        ...(modulo ? { modulo } : {}),
        ...(q ? { OR: [{ detalle: { contains: q, mode: "insensitive" } }, { accion: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { fecha: "desc" },
      take: 300,
    }),
    prisma.usuario.findMany({ orderBy: { nombre: "asc" } }),
    prisma.movimiento.findMany({ select: { modulo: true }, distinct: ["modulo"] }),
  ]);

  return (
    <>
      <h2 className="text-xl font-sora font-semibold">Bitácora de movimientos</h2>
      <p className="text-tinta2 text-sm mt-1 mb-4 max-w-[62ch]">
        Cada acción que hace cualquier usuario queda registrada aquí con su nombre, la hora y el detalle. Los registros no se pueden editar ni borrar.
      </p>

      <form className="flex gap-2 flex-wrap mb-4" action="/bitacora">
        <input className="campo-input max-w-xs" type="search" name="q" placeholder="Buscar en el detalle" defaultValue={q} />
        <select className="campo-input" name="usuario" defaultValue={usuarioId || ""}>
          <option value="">Todos los usuarios</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <select className="campo-input" name="modulo" defaultValue={modulo || ""}>
          <option value="">Todos los módulos</option>
          {modulos.map((m) => <option key={m.modulo} value={m.modulo}>{m.modulo}</option>)}
        </select>
        <button className="btn-secundario">Filtrar</button>
      </form>

      <p className="text-tinta2 text-sm mb-3">{movimientos.length} movimiento(s) (máximo 300 mostrados)</p>

      {movimientos.length ? (
        <div className="tarjeta overflow-x-auto">
          <table className="w-full tabla" style={{ minWidth: 720 }}>
            <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Módulo</th><th>Acción</th><th>Detalle</th></tr></thead>
            <tbody>
              {movimientos.map((mv) => (
                <tr key={mv.id}>
                  <td className="font-mono whitespace-nowrap">{fechaHora(mv.fecha)}</td>
                  <td>{mv.usuarioTxt}<div className="text-xs text-tinta2">{mv.rolTxt}</div></td>
                  <td>{mv.modulo}</td>
                  <td>{mv.accion}</td>
                  <td>{mv.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="tarjeta p-10 text-center text-tinta2">No hay movimientos con esos filtros.</div>
      )}
    </>
  );
}
