// PRUEBA TEMPORAL E2E — crea material con imagen, pide ese producto en una
// orden y verifica que la foto aparece en el detalle de la orden.
import { readFileSync } from "node:fs";

const ORIGEN = "http://localhost:3000";
let sesion = "";

function cookieDe(r: Response) {
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function entrar() {
  // El dev server responde404 mientras termina de compilar una ruta, así
  // que se reintenta unas veces antes de rendirse.
  let texto = "";
  for (let intento = 0; intento < 8; intento++) {
    const csrfRes = await fetch(`${ORIGEN}/api/auth/csrf`);
    texto = await csrfRes.text();
    if (texto.trim().startsWith("{")) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!texto.trim().startsWith("{")) throw new Error(`csrf devolvió: ${texto.slice(0, 100)}`);
  const { csrfToken } = JSON.parse(texto) as { csrfToken: string };
  const csrfRes2 = await fetch(`${ORIGEN}/api/auth/csrf`);
  const cookies = cookieDe(csrfRes2);
  const token = cookies.includes("csrftoken=")
    ? cookies.match(/csrftoken=([^;]+)/)?.[1]
    : csrfToken;
  const entra = await fetch(`${ORIGEN}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies },
    body: new URLSearchParams({ csrfToken: token || csrfToken, usuario: "admin", clave: "admin123", json: "true" }),
  });
  sesion = [cookies, cookieDe(entra)].filter(Boolean).join("; ");
}

async function idDe(nombre: string, pagina: string): Promise<string> {
  for (let intento = 0; intento < 8; intento++) {
    const res = await fetch(ORIGEN + pagina, { headers: { Cookie: sesion } });
    const html = await res.text();
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    if (res.status === 200 && scripts.length) {
      for (const src of scripts) {
        const js = await (await fetch(ORIGEN + src, { headers: { Cookie: sesion } })).text();
        const h = js.match(new RegExp(`var ${nombre}\\s*=[^"]*"([0-9a-f]{16,})"`));
        if (h) return h[1];
      }
    }
    console.log(`   (reintento ${intento + 1}: ${pagina} → HTTP ${res.status}, ${scripts.length} scripts)`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`sin id de ${nombre}`);
}

/** Arma el FormData igual que React: args de useFormState en "0" y los
 *  campos del form con prefijo "1_" (referencia $K1). */
function reply(campos: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of campos) fd.append(`1_${k}`, v);
  fd.set("0", '[{"error":null},"$K1"]');
  return fd;
}

async function llamar(accion: string, destino: string, fd: FormData): Promise<string> {
  const r = await fetch(ORIGEN + destino, {
    method: "POST",
    headers: {
      Cookie: sesion, "Next-Action": accion, "Next-Url": destino,
      Origin: ORIGEN, Accept: "text/x-component",
    },
    body: fd,
  });
  return `HTTP ${r.status} ${r.text ? await r.text() : ""}`.slice(0, 300);
}

async function main() {
  for (const linea of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
  const { prisma } = await import("./src/lib/prisma");
  const { borrarImagenMaterial } = await import("./src/lib/imagenes");

  await entrar();
  const idCrearMaterial = await idDe("crearMaterial", "/materiales");
  const idCrearOrden = await idDe("crearOrden", "/ordenes/nueva");
  console.log(`1. Sesión ok · actions crearMaterial=${idCrearMaterial.slice(0, 6)} crearOrden=${idCrearOrden.slice(0, 6)} ✓`);

  const proveedor = await prisma.proveedor.findFirst({ orderBy: { id: "asc" } });
  if (!proveedor) throw new Error("sin proveedores");

  /* -------- material con imagen -------- */
  const fm = reply([
    ["codigo", "PRUEBA-IMG"], ["categoria", "Prueba"], ["nombre", "Material prueba imagen"],
    ["unidad", "Unidad"], ["proveedorId", String(proveedor.id)],
    ["existencia", "5"], ["minimo", "1"], ["precio", "10.50"],
  ]);
  fm.set("1_imagen", new File([readFileSync("public/logo-camo.png")], "logo.png", { type: "image/png" }));
  fm.set("0", '[{"error":null},"$K1"]');
  const r1 = await llamar(idCrearMaterial, "/materiales", fm);
  const material = await prisma.material.findUnique({ where: { codigo: "PRUEBA-IMG" } });
  if (!material?.imagenUrl) throw new Error(`no se creó el material con imagen → ${r1}`);
  console.log(`2. Material con imagen creado ✓ (${material.imagenUrl.split("/").pop()})`);

  /* -------- orden que pide ese producto -------- */
  const fo = reply([
    ["justificacion", "Prueba E2E de imagen"],
    ["dependencia", "Pruebas"],
    ["lugar", "Santa Rosa de Copán"],
    ["materialId", String(material.id)],
    ["cantidad", "2"],
    ["precio", "10.50"],
  ]);
  const r2 = await llamar(idCrearOrden, "/ordenes/nueva", fo);
  const orden = await prisma.ordenCompra.findFirst({ where: { folio: { startsWith: "OC-" } }, orderBy: { id: "desc" } });
  if (!orden) throw new Error(`no se creó la orden → ${r2}`);
  console.log(`3. Orden creada ✓ (${orden.folio})`);

  /* -------- la imagen se ve en el detalle de la orden -------- */
  const detalle = await fetch(`${ORIGEN}/ordenes/${orden.id}`, { headers: { Cookie: sesion } });
  const html = await detalle.text();
  if (detalle.status !== 200) throw new Error(`/ordenes/${orden.id} → HTTP ${detalle.status}`);
  if (!html.includes(material.imagenUrl)) throw new Error("La imagen del producto NO aparece en el detalle de la orden");
  if (!html.includes("Material prueba imagen")) throw new Error("El material no aparece en el detalle");
  console.log("4. La imagen del producto aparece en el detalle de la orden ✓");

  /* -------- edición de la orden: la imagen llega al formulario -------- */
  const editar = await fetch(`${ORIGEN}/ordenes/${orden.id}/editar`, { headers: { Cookie: sesion } });
  const htmlE = await editar.text();
  if (editar.status !== 200 || !htmlE.includes(material.imagenUrl)) {
    throw new Error("La imagen no llega al formulario de edición de la orden");
  }
  console.log("5. La imagen llega al formulario de edición de la orden ✓");

  /* -------- limpieza -------- */
  await prisma.ordenCompra.delete({ where: { id: orden.id } }); // borra detalles en cascada
  await borrarImagenMaterial(material.imagenUrl);
  await prisma.material.delete({ where: { id: material.id } });
  await prisma.movimiento.deleteMany({
    where: { OR: [{ detalle: { contains: "PRUEBA-IMG" } }, { detalle: { contains: orden.folio } }] },
  });
  console.log("6. Limpieza OK (orden, material, imagen y bitácora borrados)\n");

  console.log("TODO CORRECTO — materiales con imagen y órdenes verificadas.");
}

main().catch(async (e) => {
  console.error("FALLÓ:", e instanceof Error ? e.message : e);
  try {
    const { prisma } = await import("./src/lib/prisma");
    const material = await prisma.material.findUnique({ where: { codigo: "PRUEBA-IMG" } });
    if (material) {
      const { borrarImagenMaterial } = await import("./src/lib/imagenes");
      await borrarImagenMaterial(material.imagenUrl);
      await prisma.ordenCompra.deleteMany({ where: { items: { some: { materialId: material.id } } } });
      await prisma.material.delete({ where: { id: material.id } });
    }
    await prisma.movimiento.deleteMany({ where: { detalle: { contains: "PRUEBA" } } });
    console.log("(limpieza de emergencia hecha)");
  } catch { /* nada */ }
  process.exit(1);
});
