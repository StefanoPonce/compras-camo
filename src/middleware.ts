// Protege todo lo está bajo el grupo (app): sin sesión, no se entra.
// Las rutas con permisos finos (reportes, bitácora, usuarios, inventario)
// se revisan además dentro de cada página, porque el middleware no debe
// decidir permisos por sí solo.
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/",
    "/proveedores/:path*",
    "/materiales/:path*",
    "/ordenes/:path*",
    "/inventario/:path*",
    "/reportes/:path*",
    "/bitacora/:path*",
    "/usuarios/:path*",
  ],
};
