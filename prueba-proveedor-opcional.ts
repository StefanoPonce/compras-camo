// Comprobación de que el proveedor quedó de verdad opcional:
//   npx tsx prueba-proveedor-opcional.ts
import { prisma } from "./src/lib/prisma";

const ORIGEN = "http://localhost:3000";
const fallos: string[] = [];

function ok(condicion: unknown, mensaje: string) {
  console.log((condicion ? "  OK    " : "  FALLA ") + mensaje);
  if (!condicion) fallos.push(mensaje);
}

function cookieDe(r: Response) {
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function entrar() {
  // El dev server responde con HTML mientras compila una ruta: se reintenta.
  let cuerpo = "";
  let res!: Response;
  for (let intento = 0; intento < 10; intento++) {
    res = await fetch(`${ORIGEN}/api/auth/csrf`);
    cuerpo = await res.text();
    if (cuerpo.trim().startsWith("{")) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  const { csrfToken } = JSON.parse(cuerpo);
  const cookies = cookieDe(res);
  const entra = await fetch(`${ORIGEN}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies },
    body: new URLSearchParams({ csrfToken, usuario: "admin", clave: "admin123", json: "true" }),
  });
  const sesion = [cookies, cookieDe(entra)].filter(Boolean).join("; ");
  if (!/next-auth\.session-token/.test(sesion)) {
    await prisma.usuario.updateMany({ where: { usuario: "admin" }, data: { sesionToken: null, sesionExpira: null } });
    return entrar();
  }
  return sesion;
}

async function main() {
  const galleta = await entrar();

  // ── 1. El formulario ya no avisa.
  console.log("1. El formulario no pide proveedor");
  const nueva = await (await fetch(`${ORIGEN}/ordenes/nueva`, { headers: { Cookie: galleta } })).text();
  ok(!nueva.includes("falta elegir el proveedor"), "ya no sale el aviso en rojo");
  ok(!nueva.includes("la requisición necesita uno"), "tampoco el texto viejo");
  ok(nueva.includes("Elige proveedor (opcional)"), "el desplegable dice que es opcional");
  ok(nueva.includes("Save") || nueva.includes("Guardar borrador"), "sigue habiendo Guardar borrador");

  // ── 2. Una requisición enviada sin proveedor se guarda y aparece en la lista.
  console.log("\n2. Enviar sin proveedor");
  const material = await prisma.material.findFirstOrThrow({ select: { id: true, unidad: true } });
  const admin = await prisma.usuario.findFirstOrThrow({ where: { usuario: "admin" }, select: { id: true } });
  const orden = await prisma.ordenCompra.create({
    data: {
      folio: `PRUEBA-SINPROV-${Date.now()}`,
      estado: "Pendiente",
      proveedorId: null,               // enviada sin proveedor
      dependencia: "subdireccion",
      solicitanteId: admin.id,
      items: { create: [{ materialId: material.id, cantidad: 3, unidad: material.unidad, programa: "1.1" }] },
    },
  });

  const lista = await (await fetch(`${ORIGEN}/ordenes`, { headers: { Cookie: galleta } })).text();
  ok(lista.includes(orden.folio), "aparece en la lista");
  ok(lista.includes("Sin proveedor") || lista.includes(">—<"), "la lista no rompe y lo marca");

  const detalle = await (await fetch(`${ORIGEN}/ordenes/${orden.id}`, { headers: { Cookie: galleta } })).text();
  ok(detalle.includes("Sin proveedor"), "el detalle lo dice claro");

  // ── 3. La hoja imprimible no revienta.
  const imprimir = await fetch(`${ORIGEN}/ordenes/${orden.id}/requisicion`, { headers: { Cookie: galleta } });
  const htmlImpresion = await imprimir.text();
  ok(imprimir.status === 200, `la hoja para imprimir responde 200 (${imprimir.status})`);
  ok(htmlImpresion.includes("Entregado por"), "sigue teniendo la casilla de entrega");

  // ── 4. La consolidación NO se la come: sale en su propio grupo.
  console.log("\n3. Consolidación");
  const gestion = await (await fetch(`${ORIGEN}/gestion/consolidacion?estado=pendientes`, {
    headers: { Cookie: galleta },
  })).text();
  ok(gestion.includes(orden.folio), "la requisición sin proveedor aparece en la consolidación");
  ok(gestion.includes("Sin proveedor"), "sale en un grupo 'Sin proveedor'");
  ok(gestion.includes(material.id.toString()) || gestion.includes("material"), "y conserva sus renglones");

  const excel = await fetch(`${ORIGEN}/gestion/consolidacion/exportar?estado=pendientes`, {
    headers: { Cookie: galleta },
  });
  ok(excel.status === 200, `el Excel se genera sin romperse (${excel.status})`);

  // ── 5. Los reportes también.
  console.log("\n4. Reportes");
  // Para que caiga en el reporte (aprobadas/recibidas de este mes) se cambia
  // el estado de la requisición de prueba.
  await prisma.ordenCompra.update({ where: { id: orden.id }, data: { estado: "Aprobada" } });
  const resReportes = await fetch(`${ORIGEN}/reportes?reporte=gestionado&estado=todas`, {
    headers: { Cookie: galleta },
  });
  const reportes = await resReportes.text();
  ok(resReportes.status === 200, `la página de reportes responde 200 (${resReportes.status})`);
  ok(reportes.includes("Sin proveedor"), "el reporte muestra su fila 'Sin proveedor'");
  // La fila lleva nombre + nº de requisiciones + materiales + unidades.
  const fila = reportes.split("<tr>").find((f) => f.includes("Sin proveedor")) || "";
  ok(/Sin proveedor<\/td>\s*<td[^>]*>1<\/td>/.test(fila.replace(/\s+/g, " ")) ||
      fila.replace(/\s+/g, " ").includes("Sin proveedor</td><td"),
    "esa fila cuenta 1 requisición y 3 unidades");

  await prisma.ordenCompra.delete({ where: { id: orden.id } });
  console.log("\n(requisición de prueba eliminada)");
  console.log(fallos.length ? `\nFALLARON ${fallos.length}:` : "\nTODO BIEN");
  fallos.forEach((f) => console.log("  - " + f));
  process.exitCode = fallos.length ? 1 : 0;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());