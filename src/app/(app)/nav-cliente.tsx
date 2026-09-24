"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { puede, nombreRol, claseRol, type Modulo, type Permiso, type Rol } from "@/lib/permisos";

export default function NavCliente({
  nombre, rol, modulos,
}: { nombre: string; rol: Rol; modulos: Modulo[] }) {
  const ruta = usePathname();
  const router = useRouter();

  // Cada sección se muestra solo a quien tiene el permiso que la rodea.
  // "Panel", "Órdenes", "Proveedores" y "Materiales" son de consulta para
  // todos los roles. Gestión reúne la consolidación de requisiciones.
  const items: [string, string, Permiso | null, Modulo][] = [
    ["/", "Panel", null, "panel"],
    ["/ordenes", "Órdenes de compra", "ordenes.crear", "ordenes"],
    ["/proveedores", "Proveedores", null, "proveedores"],
    ["/materiales", "Materiales", null, "materiales"],
    ["/gestion", "Gestión", "consolidacion.ver", "gestion"],
    ["/inventario", "Descargo de inventario", "inventario.descargar", "inventario"],
    ["/reportes", "Reportes", "reportes.ver", "reportes"],
    ["/bitacora", "Bitácora", "bitacora.ver", "bitacora"],
    ["/usuarios", "Usuarios", "usuarios.gestionar", "usuarios"],
  ];

  const visibles = items.filter(([, , permiso, modulo]) =>
    (!permiso || puede(rol, permiso)) && modulos.includes(modulo)
  );

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
          <span className={"etiqueta " + claseRol(rol)}>
            {nombreRol(rol)}
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
        {visibles.map(([href, etiqueta]) => (
          <Link
            key={href}
            href={href}
            className={
              "px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 " +
              (ruta === href || (href !== "/" && ruta.startsWith(`${href}/`))
                ? "text-verde border-verde"
                : "text-tinta2 border-transparent")
            }
          >
            {etiqueta}
          </Link>
        ))}
      </nav>
    </>
  );
}
