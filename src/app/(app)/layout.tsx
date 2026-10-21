import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ControlSesion from "./control-sesion";
import NavCliente from "./nav-cliente";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <ControlSesion />
      <NavCliente
        nombre={sesion.user.name || sesion.user.usuario}
        rol={sesion.user.rol}
        modulos={sesion.user.modulosPermitidos}
      />
      {/* El contenido usa el mismo ancho que la barra de navegación (1480px) para
          que las tablas largas no se queden estrechas y no haya que arrastrar. */}
      <main className="px-5 py-6 pb-16 max-w-[1480px] w-full mx-auto flex-1">{children}</main>
      <footer className="px-5 py-4 border-t border-borde text-tinta2 text-xs text-center">
        Datos guardados en PostgreSQL — Fundación CAMO
      </footer>
    </div>
  );
}
