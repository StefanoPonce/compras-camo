"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  claseRol,
  nombreRol,
  puede,
  type Modulo,
  type Permiso,
  type Rol,
} from "@/lib/permisos";
import estilos from "./nav-cliente.module.css";

type IconoMenu = "panel" | "ordenes" | "proveedores" | "materiales" | "gestion" | "inventario" | "reportes" | "bitacora" | "usuarios";

type ItemMenu = {
  href: string;
  etiqueta: string;
  permiso: Permiso | null;
  modulo: Modulo;
  icono: IconoMenu;
};

function IconoMenu({ tipo }: { tipo: IconoMenu }) {
  const propiedades = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  } as const;

  if (tipo === "ordenes" || tipo === "bitacora") {
    return (
      <svg {...propiedades}>
        <path d="M6 3.5h8l4 4V20.5H6v-17Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M14 3.5v4h4M9 11h6M9 15h4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
    );
  }

  if (tipo === "proveedores" || tipo === "usuarios") {
    return (
      <svg {...propiedades}>
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.65" />
        <path d="M3.5 19c.3-3.4 2.15-5.1 5.5-5.1s5.2 1.7 5.5 5.1M15.5 5.5a3 3 0 0 1 0 5.8M16 14c2.8.2 4.3 1.9 4.5 5" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
    );
  }

  if (tipo === "materiales" || tipo === "inventario") {
    return (
      <svg {...propiedades}>
        <path d="m4 8 8-4 8 4-8 4-8-4Z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M4 8v8l8 4 8-4V8M12 12v8M8 6l8 4" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
      </svg>
    );
  }

  if (tipo === "reportes") {
    return (
      <svg {...propiedades}>
        <path d="M5 20V9M12 20V4M19 20v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M3.5 20.5h17" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
    );
  }

  if (tipo === "gestion") {
    return (
      <svg {...propiedades}>
        <path d="M5 5.5h14v13H5z" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
        <path d="M8.5 9h7M8.5 12h7M8.5 15h4" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg {...propiedades}>
      <rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.65" />
      <rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.65" />
      <rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.65" />
      <rect x="14" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.65" />
    </svg>
  );
}

function IconoSalir() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 5H5v14h9M11 12h9M17 8l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function NavCliente({
  nombre,
  rol,
  modulos,
}: {
  nombre: string;
  rol: Rol;
  modulos: Modulo[];
}) {
  const ruta = usePathname();
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  // Cada sección se muestra solo a quien tiene el permiso que la rodea.
  // "Panel", "Requisiciones", "Proveedores" y "Materiales" son de consulta para
  // todos los roles. Gestión reúne la consolidación de requisiciones.
  const items: ItemMenu[] = [
    { href: "/", etiqueta: "Panel", permiso: null, modulo: "panel", icono: "panel" },
    { href: "/ordenes", etiqueta: "Requisiciones", permiso: "ordenes.crear", modulo: "ordenes", icono: "ordenes" },
    { href: "/proveedores", etiqueta: "Proveedores", permiso: null, modulo: "proveedores", icono: "proveedores" },
    { href: "/materiales", etiqueta: "Materiales", permiso: null, modulo: "materiales", icono: "materiales" },
    { href: "/gestion", etiqueta: "Gestión", permiso: "consolidacion.ver", modulo: "gestion", icono: "gestion" },
    { href: "/inventario", etiqueta: "Descargo de inventario", permiso: "inventario.descargar", modulo: "inventario", icono: "inventario" },
    { href: "/reportes", etiqueta: "Reportes", permiso: "reportes.ver", modulo: "reportes", icono: "reportes" },
    { href: "/bitacora", etiqueta: "Bitácora", permiso: "bitacora.ver", modulo: "bitacora", icono: "bitacora" },
    { href: "/usuarios", etiqueta: "Usuarios", permiso: "usuarios.gestionar", modulo: "usuarios", icono: "usuarios" },
  ];

  const visibles = items.filter(
    ({ permiso, modulo }) => (!permiso || puede(rol, permiso)) && modulos.includes(modulo),
  );

  async function salir() {
    if (saliendo) return;
    setSaliendo(true);

    try {
      await signOut({ redirect: false });
      router.replace("/login");
      router.refresh();
    } finally {
      setSaliendo(false);
    }
  }

  return (
    <div className={estilos.contenedor}>
      <header className={estilos.superior}>
        <Link href="/" className={estilos.marca} aria-label="Ir al panel del sistema">
          <span className={estilos.logoMarca}>
            <Image
              src="/logo-camo.png"
              alt="Logo Fundación CAMO"
              width={48}
              height={48}
              priority
            />
          </span>
          <span className={estilos.textoMarca}>
            <strong>CAMO Honduras</strong>
            <small>Sistema de proceso de compras</small>
          </span>
        </Link>

        <div className={estilos.accionesSuperior}>
          <span className={estilos.estadoSesion} title="La sesión se renueva mientras el navegador está abierto">
            <span aria-hidden="true" />
            Sesión activa
          </span>
          <div className={estilos.identidad} title={nombre}>
            <span className={estilos.nombreUsuario}>{nombre}</span>
            <span className={`${claseRol(rol)} ${estilos.rol}`}>{nombreRol(rol)}</span>
          </div>
          <button
            type="button"
            className={estilos.botonSalir}
            onClick={salir}
            disabled={saliendo}
            aria-label="Cerrar sesión"
          >
            <IconoSalir />
            <span>{saliendo ? "Saliendo…" : "Salir"}</span>
          </button>
        </div>
      </header>

      <nav className={estilos.navegacion} aria-label="Navegación principal">
        <div className={estilos.listaNavegacion}>
          {visibles.map(({ href, etiqueta, icono }) => {
            const activo = href === "/" ? ruta === href : ruta === href || ruta.startsWith(`${href}/`);

            return (
              <Link
                key={href}
                href={href}
                className={`${estilos.enlace} ${activo ? estilos.enlaceActivo : ""}`}
                aria-current={activo ? "page" : undefined}
              >
                <span className={estilos.iconoEnlace}>
                  <IconoMenu tipo={icono} />
                </span>
                <span>{etiqueta}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
