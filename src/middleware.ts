// Protege todo lo que está bajo el grupo (app): sin sesión, no se entra.
// Las rutas de administrador solas se revisan además dentro de cada página,
// porque el middleware no debe decidir permisos finos por sí solo.
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/",
    "/proveedores/:path*",
    "/materiales/:path*",
    "/ordenes/:path*",
    "/bitacora/:path*",
    "/usuarios/:path*",
  ],
};
