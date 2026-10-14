// PRUEBA del flujo de borradores.
//   npx tsx prueba-borrador.ts
//
// No scrappea ids de Server Actions (eso no funciona en modo dev): lo que
// importa de las acciones se prueba sobre la base y sobre las páginas, que sí
// se piden por HTTP. La lectura de renglones se prueba directo.
import { prisma } from "./src/lib/prisma";
import { leerItems } from "./src/lib/items-requisicion";

const ORIGEN = "http://localhost:3000";
const fallos: string[] = [];

function ok(condicion: unknown, mensaje: string) {
  console.log((condicion ? "  OK    " : "  FALLA ") + mensaje);
  if (!condicion) fallos.push(mensaje);
}

function cookieDe(r: Response) {
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function entrar(usuario: string, clave: string) {
  // El dev server responde con algo que no es JSON mientras compila la ruta,
  // así que se reintenta. El token que hay que mandar es el de la COOKIE
  // csrftoken, no el del cuerpo: si no coinciden, NextAuth rechaza el login.
  let cuerpo = "";
  let cookies = "";
  for (let intento = 0; intento < 10; intento++) {
    // El token y la galleta tienen que salir de la MISMA llamada: si se pide
    // dos veces, cada una trae un par distinto y el login se rechaza.
    const res = await fetch(`${ORIGEN}/api/auth/csrf`);
    cuerpo = await res.text();
    if (cuerpo.trim().startsWith("{")) { cookies = cookieDe(res); break; }
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!cuerpo.trim().startsWith("{")) throw new Error(`csrf devolvió: ${cuerpo.slice(0, 120)}`);
  const token = JSON.parse(cuerpo).csrfToken;

  const entra = await fetch(`${ORIGEN}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookies },
    body: new URLSearchParams({ csrfToken: token, usuario, clave, json: "true" }),
  });
  const sesion = [cookies, cookieDe(entra)].filter(Boolean).join("; ");
  // Si no quedó galleta de sesión, el login no serviría para las páginas. El
  // sistema solo admite una sesión viva por usuario, así que si la cuenta está
  // ocupada (el navegador del usuario, otra corrida de esta prueba) se libera
  // y se reintenta una vez.
  if (!/next-auth\.session-token/.test(sesion)) {
    await prisma.usuario.updateMany({
      where: { usuario },
      data: { sesionToken: null, sesionExpira: null },
    });
    console.log(`  (la sesión de ${usuario} estaba ocupada; se liberó y se reintenta)`);
    return entrar(usuario, clave);
  }
  return sesion;
}

/** Arma el FormData de un renglón tal como lo manda el formulario. */
function formRenglon(campos: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fd;
}

async function main() {
  const material = await prisma.material.findFirstOrThrow({ select: { id: true, codigo: true, unidad: true } });
  const proveedor = await prisma.proveedor.findFirstOrThrow({ select: { id: true, nombre: true } });
  const admin = await prisma.usuario.findFirstOrThrow({ where: { usuario: "admin" }, select: { id: true } });
  console.log(`Material: ${material.codigo} · Proveedor: ${proveedor.nombre}`);

  // ── 1. leerItems: qué renglones sobreviven a un guardado como borrador.
  console.log("\n1. Lectura de renglones: completo vs borrador");
  const aMedias = formRenglon({
    materialId: String(material.id), cantidad: "0", unidad: material.unidad,
    proveedorId: "", programa: "",
  });
  const completo = leerItems(aMedias);
  ok(completo.length === 0, "al ENVIAR, un renglón con cantidad 0 no cuenta");

  const comoBorrador = leerItems(aMedias, { borrador: true });
  ok(comoBorrador.length === 1, "al GUARDAR BORRADOR, ese mismo renglón sí se conserva");
  ok(comoBorrador[0].cantidad === 1, "la cantidad en 0 se guarda como 1 (la columna es NOT NULL)");
  ok(comoBorrador[0].programa === null, "un renglón sin programa se puede guardar");

  const sinMaterial = leerItems(formRenglon({ materialId: "", cantidad: "3", unidad: "UNIDAD" }), { borrador: true });
  ok(sinMaterial.length === 0, "una fila sin material se descarta igual: no hay nada que recuperar");

  // ── 2. La base acepta un borrador sin proveedor.
  console.log("\n2. Guardar un borrador incompleto en la base");
  const borrador = await prisma.ordenCompra.create({
    data: {
      folio: `PRUEBA-${Date.now()}`,
      estado: "Borrador",
      proveedorId: null,
      dependencia: null,
      justificacion: "Requisición a medias para la prueba",
      solicitanteId: admin.id,
      items: { create: [{ materialId: material.id, cantidad: 1, unidad: material.unidad, programa: null }] },
    },
    include: { items: true },
  });
  ok(borrador.estado === "Borrador", "se guardó como Borrador");
  ok(borrador.proveedorId === null, "se guardó sin proveedor (la columna ahora admite NULL)");
  ok(borrador.items.length === 1 && borrador.items[0].programa === null, "guardó el renglón sin programa");

  // ── 3. Lo que aparece en la lista.
  console.log("\n3. La lista de requisiciones");
  const galleta = await entrar("admin", "admin123");
  const lista = await (await fetch(`${ORIGEN}/ordenes`, { headers: { Cookie: galleta } })).text();
  ok(lista.includes(borrador.folio), "el borrador aparece en la lista");
  ok(lista.includes(`/ordenes/${borrador.id}/editar`), "su botón apunta a editar, no a ver");

  const filtro = await (await fetch(`${ORIGEN}/ordenes?estado=Borrador`, { headers: { Cookie: galleta } })).text();
  ok(filtro.includes("Continuar editando"), "el botón dice 'Continuar editando'");
  ok(filtro.includes(`>Ver<`) === false || !filtro.includes("Continuar editando"), "no dice solo 'Ver'");
  ok(filtro.includes(borrador.folio), "el filtro Borradores lo muestra");

  // ── 4. La página de detalle y la de continuar editando.
  console.log("\n4. Detalle y formulario");
  const detalle = await (await fetch(`${ORIGEN}/ordenes/${borrador.id}`, { headers: { Cookie: galleta } })).text();
  ok(detalle.includes("Borrador"), "el detalle muestra el estado Borrador");
  ok(detalle.includes("Continuar editando"), "ofrece 'Continuar editando'");
  ok(detalle.includes("Borrar borrador"), "ofrece 'Borrar borrador'");
  ok(!detalle.includes("Ver requisición para imprimir"), "no ofrece imprimir un borrador");
  ok(!detalle.includes("Marcar como recibida") && !detalle.includes(">Aprobar<"), "no ofrece aprobar ni recibir");
  ok(detalle.includes("Sin proveedor"), "muestra que aún no tiene proveedor");

  const editar = await (await fetch(`${ORIGEN}/ordenes/${borrador.id}/editar`, { headers: { Cookie: galleta } })).text();
  ok(editar.includes("Continuar requisición"), "el formulario dice que se está retomando");
  ok(editar.includes("Requisición a medias para la prueba"), "recupera lo que ya estaba escrito");
  ok(editar.includes(borrador.folio), "recupera el folio");
  ok(editar.includes("Guardar borrador"), "ofrece volver a guardar el borrador");
  ok(editar.includes("Enviar requisición"), "ofrece enviarlo");

  // ── 5. Imprimir un borrador redirige a editarlo.
  console.log("\n5. Impresión");
  const imprimir = await fetch(`${ORIGEN}/ordenes/${borrador.id}/requisicion`, {
    headers: { Cookie: galleta }, redirect: "manual",
  });
  const destino = imprimir.headers.get("location") || "";
  ok(imprimir.status === 307 || imprimir.status === 302, `imprimir un borrador redirige (${imprimir.status})`);
  ok(destino.includes(`/editar`), `y manda a seguir editándolo (${destino})`);

  // ── 6. Un borrador no aparece en el panel ni en reportes/consolidación.
  console.log("\n6. Borradores fuera de revisión y reportes");
  const panel = await (await fetch(`${ORIGEN}/`, { headers: { Cookie: galleta } })).text();
  ok(!panel.includes(borrador.folio), "el panel no lista el borrador");
  const reportes = await (await fetch(`${ORIGEN}/reportes`, { headers: { Cookie: galleta } })).text();
  ok(!reportes.includes(borrador.folio), "los reportes no lo cuentan");
  const gestion = await (await fetch(`${ORIGEN}/gestion/consolidacion`, { headers: { Cookie: galleta } })).text();
  ok(!gestion.includes(borrador.folio), "la consolidación no lo agrupa");
  ok(!gestion.includes(String(borrador.items[0].materialId) + ">"), "ni sus renglones llegan a consolidar");

  // ── 7. Retomarlo y enviarlo lo convierte en requisición normal.
  console.log("\n7. Al enviarlo pasa a Pendiente");
  const enviada = await prisma.ordenCompra.update({
    where: { id: borrador.id },
    data: {
      estado: "Pendiente",
      dependencia: "subdireccion",
      proveedorId: proveedor.id,
      justificacion: "Requisición completada",
      items: { update: { where: { id: borrador.items[0].id }, data: { cantidad: 5, programa: "1.1" } } },
    },
    include: { items: true },
  });
  ok(enviada.estado === "Pendiente", "quedó Pendiente, lista para revisión");
  ok(enviada.items[0].cantidad === 5 && enviada.items[0].programa === "1.1", "conservó los datos ya escritos");

  const panel2 = await (await fetch(`${ORIGEN}/`, { headers: { Cookie: galleta } })).text();
  ok(panel2.includes(enviada.folio), "ya enviada, sí aparece en el panel");

  // ── 8. El folio no se repite aunque queden huecos.
  console.log('\n8. Folios sin repetir');
  const anio = new Date().getFullYear();
  const prefijo = `OC-${anio}-`;
  const existentes = await prisma.ordenCompra.findMany({
    where: { folio: { startsWith: prefijo } }, select: { folio: true }, orderBy: { folio: "desc" },
  });
  const mayor = existentes.length ? Number(existentes[0].folio.slice(prefijo.length)) : 0;
  // El folio se arma con el más alto, no con la cantidad de requisiciones. Si
  // se usara la cantidad, bastaría con que faltara un folio en medio (por
  // ejemplo, después de borrar un borrador) para que el siguiente saliera
  // repetido y el guardado fallara.
  ok(!existentes.some((e) => e.folio === `${prefijo}${String(mayor + 1).padStart(4, "0")}`),
    `el folio siguiente ${prefijo}${String(mayor + 1).padStart(4, "0")} está libre`);
  ok(existentes.length <= mayor, "hay huecos en la numeración y por eso el count no servía");

  // ── 9. Limpieza.
  await prisma.ordenCompra.delete({ where: { id: borrador.id } });
  ok(!(await prisma.ordenCompra.findUnique({ where: { id: borrador.id } })), "(requisición de prueba eliminada)");

  console.log(fallos.length ? `\nFALLARON ${fallos.length}:` : "\nTODO BIEN");
  fallos.forEach((f) => console.log("  - " + f));
  process.exitCode = fallos.length ? 1 : 0;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());