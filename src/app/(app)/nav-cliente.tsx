"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";

export default function NavCliente({
  nombre, rol,
}: { nombre: string; rol: "usuario" | "administrador" }) {
  const ruta = usePathname();
  const router = useRouter();
  const esAdmin = rol === "administrador";

  const items: [string, string][] = [
    ["/", "Panel"],
    ["/ordenes", "Órdenes de compra"],
    ["/proveedores", "Proveedores"],
    ["/materiales", "Materiales"],
  ];
  if (esAdmin) { items.push(["/reportes", "Reportes"], ["/bitacora", "Bitácora"], ["/usuarios", "Usuarios"]); }

  return (
    <>
      <header className="bg-superficie border-b border-borde px-5 py-3 flex items-center gap-4 flex-wrap">
        <span className="font-sora font-semibold">Compras — Fundación CAMO</span>
        <div className="flex justify-center mb-1">
              <Image
                src="/logo-camo.png"
                alt="Logo Fundación CAMO"
                width={50}
                height={50}
              
              />
            </div>
        <div className="ml-auto flex items-center gap-2.5 text-sm text-tinta2">
          <span>{nombre}</span>
          <span className={"etiqueta " + (esAdmin ? "et-admin" : "et-usuario")}>
            {esAdmin ? "Administrador" : "Usuario"}
          </span>
          <button
            className="btn-secundario btn-chico"
            onClick={() => signOut({ redirect: false }).then(() => router.push("/login"))}
          >
            Salir
          </button>
        </div>
      </header>
      <nav className="bg-superficie border-b border-borde px-3 flex gap-0.5 overflow-x-auto">
        {items.map(([href, etiqueta]) => (
          <Link
            key={href}
            href={href}
            className={
              "px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 " +
              (ruta === href ? "text-verde border-verde" : "text-tinta2 border-transparent")
            }
          >
            {etiqueta}
          </Link>
        ))}
      </nav>
    </>
  );
}
