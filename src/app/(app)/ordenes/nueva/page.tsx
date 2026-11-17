import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { puedeVerModulo } from "@/lib/permisos";
import { crearOrden } from "../../actions";
import FormularioOrden from "../formulario-orden";
import Link from "next/link";

export default async function NuevaOrden() {
  const sesion = await getServerSession(authOptions);
  if (!sesion || !puedeVerModulo(sesion.user.rol, sesion.user.modulosPermitidos, "ordenes")) redirect("/");

  const [materiales, proveedores] = await Promise.all([
    // El orden por nombre es la base; el orden definitivo de la lista
    // desplegable lo aplica el formulario (ver ahí el porqué).
    prisma.material.findMany({ include: { proveedor: true }, orderBy: { nombre: "asc" } }),
    prisma.proveedor.findMany({ orderBy: { nombre: "asc" } }),
  ]);

  return (
    <>
      {/* El botón de regreso arriba del todo: el formulario es largo y no hay
          que bajar hasta los botones de abajo para salir sin guardar. */}
      <div className="flex items-start gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-xl font-sora font-semibold">Nueva requisición</h2>
        </div>
        <div className="ml-auto">
          <Link href="/ordenes" className="btn-secundario">
            Volver a la lista de requisiciones
          </Link>
        </div>
      </div>
      <FormularioOrden
        accion={crearOrden}
        materiales={materiales}
        proveedores={proveedores}
      />
    </>
  );
}