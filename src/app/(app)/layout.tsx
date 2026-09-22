import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import NavCliente from "./nav-cliente";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sesion = await getServerSession(authOptions);
  if (!sesion) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <NavCliente nombre={sesion.user.name || sesion.user.usuario} rol={sesion.user.rol} />
      <main className="px-5 py-6 pb-16 max-w-6xl w-full mx-auto flex-1">{children}</main>
      <footer className="px-5 py-4 border-t border-borde text-tinta2 text-xs text-center">
        Datos guardados en PostgreSQL — Fundación CAMO
      </footer>
    </div>
  );
}
