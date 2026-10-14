import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expiracionCierreSuave, nuevaExpiracionSesion } from "@/lib/sesion-control";

export const runtime = "nodejs";

const NOMBRES_COOKIE_SESION = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

type AccionSesion = "latido" | "cerrar";

function borrarCookieSesion(respuesta: NextResponse) {
  respuesta.headers.set("Cache-Control", "no-store");

  for (const nombre of NOMBRES_COOKIE_SESION) {
    respuesta.cookies.set(nombre, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      secure: nombre.startsWith("__Secure-"),
    });
  }
  return respuesta;
}

function respuestaSesionInvalida() {
  return borrarCookieSesion(
    NextResponse.json(
      { error: "La sesión ya no está activa." },
      { status: 401 },
    ),
  );
}

export async function POST(request: NextRequest) {
  // Esta ruta solo se usa desde la propia aplicación. La cookie es SameSite y
  // esta comprobación evita que otra página intente cerrar la sesión ajena.
  const sitio = request.headers.get("sec-fetch-site");
  if (sitio && sitio !== "same-origin" && sitio !== "none") {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  let accion: AccionSesion;
  try {
    const cuerpo = (await request.json()) as { accion?: AccionSesion };
    accion = cuerpo.accion ?? "latido";
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (accion !== "latido" && accion !== "cerrar") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  const token = await getToken({ req: request });
  const id = Number(token?.id);
  const tokenSesion = token?.sesionToken;

  if (!Number.isInteger(id) || typeof tokenSesion !== "string" || !tokenSesion) {
    return respuestaSesionInvalida();
  }

  if (accion === "cerrar") {
    // Cierre SUAVE. OJO: aquí no se borra ni el sesionToken ni la cookie.
    //
    // Cuando el navegador suelta la página no se puede distinguir un cierre
    // real de una recarga: en una recarga la página vieja avisa que se va
    // antes de que exista la nueva. Por eso solo se acorta el vencimiento y se
    // deja todo lo demás intacto:
    //   - si fue una recarga, la página nueva llega enseguida, su cookie sigue
    //     ahí y su latido renueva la sesión otra vez;
    //   - si el navegador se cerró de verdad, nadie renueva y al vencer este
    //     margen la cuenta queda libre para un nuevo ingreso.
    await prisma.usuario.updateMany({
      where: { id, sesionToken: tokenSesion, sesionExpira: { gt: new Date() } },
      data: { sesionExpira: expiracionCierreSuave() },
    });

    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }

  // El navegador renueva el permiso mientras está abierto. Si deja de hacerlo
  // (crash, cierre abrupto o pérdida de red), este vencimiento de dos minutos
  // libera la cuenta para un nuevo inicio de sesión.
  const ahora = new Date();
  const renovacion = await prisma.usuario.updateMany({
    where: {
      id,
      activo: true,
      sesionToken: tokenSesion,
      sesionExpira: { gt: ahora },
    },
    data: { sesionExpira: nuevaExpiracionSesion(ahora) },
  });

  if (renovacion.count !== 1) {
    await prisma.usuario.updateMany({
      where: { id, sesionToken: tokenSesion },
      data: { sesionToken: null, sesionExpira: null },
    });
    return respuestaSesionInvalida();
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
