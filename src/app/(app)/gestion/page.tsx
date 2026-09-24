import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { puede, puedeVerModulo } from "@/lib/permisos";

export default async function Gestion() {
  const sesion = await getServerSession(authOptions);
  if (!sesion) redirect("/login");
  if (!puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "gestion")) redirect("/");
  if (!puede(sesion.user.rol, "consolidacion.ver")) redirect("/");

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-verde mb-1">Módulo</div>
        <h2 className="text-xl font-sora font-semibold">Gestión</h2>
        <p className="text-tinta2 text-sm mt-1">
          Herramientas de administración y seguimiento del proceso de compras.
        </p>
      </div>

      <div className="tarjeta p-5">
        <h3 className="font-sora text-lg font-semibold">Consolidación de compras</h3>
        <p className="text-sm text-tinta2 mt-2 max-w-[58ch]">
          Reúne las requisiciones por proveedor, muestra los materiales consolidados y sus totales para preparar
          la compra. Las órdenes originales no se modifican.
        </p>
        <Link href="/gestion/consolidacion" className="btn mt-4 inline-flex">
          Abrir consolidación
        </Link>
      </div>
    </div>
  );
}
