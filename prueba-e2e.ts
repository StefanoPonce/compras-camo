// PRUEBA TEMPORAL E2E — entra con sesión real, crea un material con imagen
// y verifica el recorrido completo por la interfaz (materiales y órdenes).
import { readFileSync } from "node:fs";

const ORIGEN = "http://localhost:3000";

async function main() {
  for (const linea of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
  const { prisma } = await import("./src/lib/prisma");
  const { borrarImagenMaterial } = await import("./src/lib/imagenes");

  /* ---------------------------- 1. iniciar sesión ---------------------------- */
  const csrfRes = await fetch(`${ORIGEN}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const cookieDe = (r: Response) =>
    r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

  const entra = await fetch(`${ORIGEN}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieDe(csrfRes),
    },
    body: new URLSearchParams({ csrfToken, usuario: "admin", clave: "admin123", json: "true" }),
  });
  const sesion = [cookieDe(csrfRes), cookieDe(entra)].filter(Boolean).join("; ");
  const cuerpo = await entra.text();
  if (entra.status !== 200 || cuerpo.includes('"code"')) {
    throw new Error(`No se pudo iniciar sesión (${entra.status}): ${cuerpo.slice(0, 200)}`);
  }
  console.log("1. Sesión iniciada como admin ✓");

  /* -------------------- 2. la página de materiales carga -------------------- */
  const pagina = await fetch(`${ORIGEN}/materiales`, { headers: { Cookie: sesion } });
  const html = await pagina.text();
  if (pagina.status !== 200 || !html.includes("Nuevo material")) {
    throw new Error(`/materiales no cargó bien (HTTP ${pagina.status})`);
  }
  // El id de la server action viaja embebido en el chunk del cliente, junto
  // al nombre de la función:  var crearMaterial = createServerReference)("…")
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  let accion: string | null = null;
  for (const src of scripts) {
    const js = await (await fetch(ORIGEN + src, { headers: { Cookie: sesion } })).text();
    const hallado = js.match(/var crearMaterial\s*=[^"]*"([0-9a-f]{16,})"/);
    if (hallado) { accion = hallado[1]; break; }
  }
  if (!accion) throw new Error("No se encontró el ID de la server action crearMaterial");
  console.log(`2. /materiales carga ✓ (server action ${accion.slice(0, 8)}…)`);

  /* ------------- 3. crear el material con imagen vía la action -------------- */
  const proveedor = await prisma.proveedor.findFirst({ orderBy: { id: "asc" } });
  if (!proveedor) throw new Error("No hay proveedores en la BD para la prueba");

  // Formato exacto que React (processReply) arma en el navegador para
  // useFormState: campo "0" = args serializados [prevState, formData] y
  // los campos del formulario con prefijo "1_" (por la referencia $K1).
  const fd = new FormData();
  fd.set("1_codigo", "PRUEBA-IMG");
  fd.set("1_categoria", "Prueba");
  fd.set("1_nombre", "Material prueba imagen");
  fd.set("1_unidad", "Unidad");
  fd.set("1_proveedorId", String(proveedor.id));
  fd.set("1_existencia", "5");
  fd.set("1_minimo", "1");
  fd.set("1_precio", "10.50");
  fd.set("1_imagen", new File([readFileSync("public/logo-camo.png")], "logo.png", { type: "image/png" }));
  fd.set("0", '[{"error":null},"$K1"]');

  const responde = await fetch(`${ORIGEN}/materiales`, {
    method: "POST",
    headers: {
      Cookie: sesion,
      "Next-Action": accion,
      "Next-Url": "/materiales",
      Origin: ORIGEN,
      Accept: "text/x-component",
    },
    body: fd,
  });
  const salida = await responde.text();
  console.log(`3. Server action respondió HTTP ${responde.status}`);
  if (responde.status !== 200) {
    throw new Error(`La action falló: ${salida.slice(0, 400)}`);
  }

  const material = await prisma.material.findUnique({ where: { codigo: "PRUEBA-IMG" } });
  if (!material) {
    throw new Error(`El material no se creó en la BD. Respuesta: ${salida.slice(0, 400)}`);
  }
  if (!material.imagenUrl) throw new Error("El material se creó pero sin imagenUrl");
  console.log(`4. Material creado en la BD con imagen ✓\n   ${material.imagenUrl}`);

  /* ------------------- 4. la imagen responde y se muestra ------------------- */
  const foto = await fetch(material.imagenUrl);
  const tipo = foto.headers.get("content-type") || "";
  if (!foto.ok || !tipo.startsWith("image/")) throw new Error(`La imagen no carga (HTTP ${foto.status}, ${tipo})`);
  console.log(`5. Imagen pública carga ✓ (${tipo}, ${(await foto.arrayBuffer()).byteLength} bytes)`);

  const lista = await fetch(`${ORIGEN}/materiales`, { headers: { Cookie: sesion } });
  const html2 = await lista.text();
  if (!html2.includes(material.imagenUrl)) throw new Error("La imagen no aparece en la tabla de /materiales");
  console.log("6. La miniatura aparece en la tabla de materiales ✓");

  const nueva = await fetch(`${ORIGEN}/ordenes/nueva`, { headers: { Cookie: sesion } });
  const html3 = await nueva.text();
  if (nueva.status !== 200 || !html3.includes("PRUEBA-IMG")) {
    throw new Error(`/ordenes/nueva no carga el material (HTTP ${nueva.status})`);
  }
  if (!html3.includes(material.imagenUrl)) throw new Error("La imagen del producto NO llega al formulario de órdenes");
  console.log("7. La imagen viaja al formulario de órdenes ✓");

  /* --------------------------- 5. dejar limpio --------------------------- */
  await borrarImagenMaterial(material.imagenUrl);
  await prisma.material.delete({ where: { id: material.id } });
  await prisma.movimiento.deleteMany({ where: { detalle: { contains: "PRUEBA-IMG" } } });
  console.log("8. Limpieza OK (material, imagen y bitácora de prueba borrados)\n");

  console.log("TODO CORRECTO — flujo completo de imágenes verificado.");
}

main().catch(async (e) => {
  console.error("FALLÓ:", e instanceof Error ? e.message : e);
  try {
    const { prisma } = await import("./src/lib/prisma");
    await prisma.material.deleteMany({ where: { codigo: "PRUEBA-IMG" } });
    await prisma.movimiento.deleteMany({ where: { detalle: { contains: "PRUEBA-IMG" } } });
    console.log("(se limpió el material de prueba si llegó a crearse)");
  } catch { /* nada */ }
  process.exit(1);
});
