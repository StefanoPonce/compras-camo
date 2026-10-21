export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** La exportación vive en /gestion/exportar. Esta ruta se deja apuntando
 *  allí para que los enlaces guardados sigan descargando el Excel. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const destino = new URL("/gestion/exportar", url.origin);
  destino.search = url.search;
  return Response.redirect(destino, 307);
}
