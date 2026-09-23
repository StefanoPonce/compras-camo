// PRUEBA E2E de roles y permisos + descargo de inventario + catálogo importado.
// Corre contra `next dev -p 3100`.
import { readFileSync } from "node:fs";

const ORIGEN = "http://localhost:3100";

function cargarEnv() {
  for (const linea of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z_0-9]*)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const cookieDe = (r: Response) => r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

async function entrar(usuario: string, clave: string): Promise<string> {
  // El dev server responde 404 mientras termina de compilar una ruta,
  // así que se reintenta antes de rendirse.
  let csrfRes: Response | null = null;
  let cuerpoCsrf = "";
  for (let intento = 0; intento < 8; intento++) {
    csrfRes = await fetch(`${ORIGEN}/api/auth/csrf`);
    cuerpoCsrf = await csrfRes.text();
    if (cuerpoCsrf.trim().startsWith("{")) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (!csrfRes || !cuerpoCsrf.trim().startsWith("{")) {
    throw new Error(`csrf devolvió: ${cuerpoCsrf.slice(0, 120)}`);
  }
  const { csrfToken } = JSON.parse(cuerpoCsrf) as { csrfToken: string };
  const entra = await fetch(`${ORIGEN}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookieDe(csrfRes) },
    body: new URLSearchParams({ csrfToken, usuario, clave, json: "true" }),
  });
  const cuerpo = await entra.text();
  if (entra.status !== 200 || cuerpo.includes('"code"')) {
    throw new Error(`No entró ${usuario} (${entra.status}): ${cuerpo.slice(0, 150)}`);
  }
  return [cookieDe(csrfRes), cookieDe(entra)].filter(Boolean).join("; ");
}

/** Devuelve el status y si el HTML contiene (o no) un texto. */
async function pagina(ruta: string, sesion: string) {
  const r = await fetch(ORIGEN + ruta, { headers: { Cookie: sesion }, redirect: "manual" });
  const html = await r.status === 200 || r.status === 307 ? await r.text() : "";
  return { status: r.status, html };
}

function si(cond: boolean, ok: string, mal: string) {
  if (!cond) throw new Error(mal);
  console.log(`  ✓ ${ok}`);
}

/** El id de una server action viaja embebido en los chunks del cliente:
 *  `var nombre = createServerReference)("hex…")`. */
async function accionDe(ruta: string, nombre: string, sesion: string): Promise<string> {
  const html = (await pagina(ruta, sesion)).html;
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const src of scripts) {
    const js = await (await fetch(ORIGEN + src, { headers: { Cookie: sesion } })).text();
    const hallado = js.match(new RegExp(`var ${nombre}\\s*=[^"]*"([0-9a-f]{16,})"`));
    if (hallado) return hallado[1];
  }
  throw new Error(`No se encontró el ID de la server action ${nombre}`);
}

async function main() {
  cargarEnv();
  const { prisma } = await import("./src/lib/prisma");

  const roles: Record<string, string> = {
    admin: "administrador",
    subadmin: "sub_administrador",
    jefe: "jefe_inmediato",
    compras: "responsable_solicitante",
  };

  /* ------------------- 1. cada rol entra y ve su menú ------------------- */
  console.log("1. Sesión y menú por rol");
  const sesiones: Record<string, string> = {};
  for (const [u, rol] of Object.entries(roles)) {
    sesiones[u] = await entrar(u, u === "admin" ? "admin123" : "compras123");
  }

  const navAdmin = await pagina("/", sesiones.admin);
  si(navAdmin.html.includes("Usuarios") && navAdmin.html.includes("Bitácora") && navAdmin.html.includes("Reportes"),
    "Administrador ve Usuarios, Bitácora y Reportes",
    "Al administrador le faltan secciones del menú");
  si(navAdmin.html.includes("Descargo de inventario"), "Administrador ve 'Descargo de inventario'",
    "Al administrador le falta el apartado de descargo");

  const navSub = await pagina("/", sesiones.subadmin);
  si(navSub.html.includes("Reportes") && !navAdmin.html.includes("x-xxxxxxxx"),
    "Sub Administrador ve Reportes", "Al Sub Administrador le falta Reportes");
  si(!navSub.html.includes(">Usuarios<") && !navSub.html.includes(">Bitácora<"),
    "Sub Administrador NO ve Usuarios ni Bitácora", "El Sub Administrador ve secciones que no le corresponden");
  si(navSub.html.includes("Descargo de inventario"), "Sub Administrador ve el descargo",
    "Al Sub Administrador le falta el descargo");

  const navJefe = await pagina("/", sesiones.jefe);
  si(navJefe.html.includes("Reportes"), "Jefe inmediato ve Reportes", "Al Jefe le falta Reportes");
  si(!navJefe.html.includes("Descargo de inventario"), "Jefe inmediato NO ve el descargo de inventario",
    "El Jefe ve el descargo y no debería");

  const navResp = await pagina("/", sesiones.compras);
  si(navResp.html.includes("Descargo de inventario"), "Responsable ve 'Descargo de inventario'",
    "Al Responsable le falta el descargo");
  si(!navResp.html.includes(">Reportes<") && !navResp.html.includes(">Usuarios<"),
    "Responsable NO ve Reportes ni Usuarios", "El Responsable ve secciones que no le corresponden");

  /* ------------- 2. acceso directo a rutas según permisos ------------- */
  console.log("2. Acceso a rutas protegidas");
  const rUsuariosResp = await pagina("/usuarios", sesiones.compras);
  si(rUsuariosResp.status === 307, "Responsable es redirigido desde /usuarios",
    `Responsable pudo ver /usuarios (HTTP ${rUsuariosResp.status})`);

  const rUsuariosAdmin = await pagina("/usuarios", sesiones.admin);
  si(rUsuariosAdmin.status === 200 && rUsuariosAdmin.html.includes("Nuevo usuario"),
    "Administrador sí entra a /usuarios", `El admin no pudo entrar a /usuarios (HTTP ${rUsuariosAdmin.status})`);
  si(rUsuariosAdmin.html.includes("Sub Administrador") && rUsuariosAdmin.html.includes("Jefe inmediato"),
    "El selector de rol ofrece los 4 roles", "El formulario de usuario no lista los 4 roles");

  const rReportesJefe = await pagina("/reportes", sesiones.jefe);
  si(rReportesJefe.status === 200, "Jefe inmediato sí entra a /reportes",
    `El jefe fue redirigido desde /reportes (HTTP ${rReportesJefe.status})`);

  const rReportesResp = await pagina("/reportes", sesiones.compras);
  si(rReportesResp.status === 307, "Responsable es redirigido desde /reportes",
    `Responsable pudo ver /reportes (HTTP ${rReportesResp.status})`);

  const rBitacoraJefe = await pagina("/bitacora", sesiones.jefe);
  si(rBitacoraJefe.status === 307, "Jefe inmediato es redirigido desde /bitácora",
    `El jefe pudo ver /bitacora (HTTP ${rBitacoraJefe.status})`);

  const rInvJefe = await pagina("/inventario", sesiones.jefe);
  si(rInvJefe.status === 307, "Jefe inmediato es redirigido desde /inventario",
    `El jefe pudo entrar a /inventario (HTTP ${rInvJefe.status})`);

  const rInvResp = await pagina("/inventario", sesiones.compras);
  si(rInvResp.status === 200 && rInvResp.html.includes("Descargo de inventario"),
    "Responsable sí entra a /inventario", `El Responsable no pudo entrar a /inventario (HTTP ${rInvResp.status})`);
  si(rInvResp.html.includes("Últimos descargos"), "El apartado muestra el historial de descargos",
    "El apartado de inventario no muestra el historial");

  /* ---------------- 3. el descargo resta existencia real ---------------- */
  console.log("3. Descargo de inventario (acción real)");
  // El catálogo viene del Excel y arranca en existencia 0, así que a un
  // material se le pone stock temporal y al final se restaura el original.
  let material = await prisma.material.findFirst({ where: { activo: true }, orderBy: { codigo: "asc" } });
  if (!material) throw new Error("No hay materiales en el catálogo para la prueba");

  const existenciaOriginal = material.existencia;
  if (material.existencia < 3) {
    await prisma.material.update({ where: { id: material.id }, data: { existencia: 10 } });
    material = { ...material, existencia: 10 };
  }

  const antes = material.existencia;
  const aRestar = 3;

  // El id de la server action viaja en los chunks del cliente.
  const accion = await accionDe("/inventario", "descargarInventario", sesiones.compras);
  console.log(`  · server action ${accion.slice(0, 8)}…`);

  const fd = new FormData();
  fd.set("1_materialId", String(material.id));
  fd.set("1_cantidad", String(aRestar));
  fd.set("1_motivo", "Prueba e2e de descargo");
  fd.set("0", '[{"error":null},"$K1"]');

  const responde = await fetch(`${ORIGEN}/inventario`, {
    method: "POST",
    headers: {
      Cookie: sesiones.compras,
      "Next-Action": accion,
      "Next-Url": "/inventario",
      Origin: ORIGEN,
      Accept: "text/x-component",
    },
    body: fd,
  });
  const salida = await responde.text();
  if (responde.status !== 200) throw new Error(`La action falló (HTTP ${responde.status}): ${salida.slice(0, 300)}`);
  if (salida.includes("Existencia insuficiente") || salida.includes("no tiene permiso")) {
    throw new Error(`La action devolvió error: ${salida.slice(0, 300)}`);
  }

  const despues = await prisma.material.findUnique({ where: { id: material.id } });
  if (!despues || despues.existencia !== antes - aRestar) {
    throw new Error(`La existencia no se restó: antes ${antes}, ahora ${despues?.existencia}`);
  }
  console.log(`  ✓ Existencia restada: ${antes} → ${despues.existencia} (${material.codigo})`);

  const descargo = await prisma.descargoInventario.findFirst({
    where: { materialId: material.id, motivo: "Prueba e2e de descargo" },
    orderBy: { id: "desc" },
  });
  if (!descargo) throw new Error("No se creó el registro en descargos_inventario");
  si(descargo.existenciaAntes === antes && descargo.existenciaDespues === antes - aRestar
    && descargo.cantidad === aRestar,
    "El registro del descargo guarda antes → después y la cantidad",
    "El registro del descargo tiene datos inconsistentes");

  const mov = await prisma.movimiento.findFirst({
    where: { accion: "Descargó inventario", detalle: { contains: material.codigo } },
    orderBy: { id: "desc" },
  });
  if (!mov) throw new Error("El descargo no quedó en la bitácora");
  si(mov.rolTxt === "Responsable de solicitar",
    `Bitácora registra el rol legible (${mov.rolTxt})`,
    `La bitácora guardó un rol raro: ${mov.rolTxt}`);

  /* -------- 4. un rol sin permiso no puede descargar por acción -------- */
  console.log("4. Un rol sin permiso no puede descargar");
  const sinPermiso = await fetch(`${ORIGEN}/inventario`, {
    method: "POST",
    headers: {
      Cookie: sesiones.jefe,
      "Next-Action": accion,
      "Next-Url": "/inventario",
      Origin: ORIGEN,
      Accept: "text/x-component",
    },
    body: fd,
  });
  const salidaJefe = await sinPermiso.text();
  si(salidaJefe.includes("no tiene permiso"),
    "La acción del servidor rechaza al Jefe inmediato",
    `El jefe pasó el permiso de descargo: ${salidaJefe.slice(0, 200)}`);

  /* ------------- 5. el catálogo del Excel y las variantes ------------ */
  console.log("5. Catálogo importado del Excel (códigos, familias y variantes)");
  const [nMateriales, nProveedores, proveedoresSinCodigo] = await Promise.all([
    prisma.material.count(),
    prisma.proveedor.count(),
    prisma.proveedor.count({ where: { codigo: null } }),
  ]);
  si(nMateriales === 314,
    "Se importaron los 314 productos del catálogo",
    `El catálogo tiene ${nMateriales} materiales, se esperaban los 314 del Excel`);
  si(nProveedores === 28 && proveedoresSinCodigo === 0,
    "Los 28 proveedores tienen código (PROV-001…PROV-028 generados)",
    `Hay ${nProveedores} proveedores y ${proveedoresSinCodigo} sin código`);

  const bolsa = await prisma.material.findFirst({ where: { familia: "BOLSA PLASTICA" } });
  si(Boolean(bolsa?.variante),
    `Las variantes se derivaron (ej. ${bolsa?.codigo} ${bolsa?.nombre} → ${bolsa?.variante})`,
    "El material de bolsa no quedó con familia/variante");

  const rMat = await pagina("/materiales?fam=" + encodeURIComponent("BOLSA PLASTICA"), sesiones.admin);
  si(rMat.status === 200 && rMat.html.includes("4X8") && rMat.html.includes("6X10"),
    "El filtro por familia lista las variantes del mismo producto",
    "El filtro por familia no devolvió las variantes de BOLSA PLASTICA");

  const rProv = await pagina("/proveedores", sesiones.admin);
  si(rProv.status === 200 && rProv.html.includes("PROV-001"),
    "La lista de proveedores muestra el código",
    "La lista de proveedores no muestra el código");

  // El Excel no relaciona materiales con proveedores: el formulario tiene que
  // poder pedirlo ahí mismo para que se pueda crear una orden.
  const rNueva = await pagina("/ordenes/nueva", sesiones.compras);
  si(rNueva.status === 200 && rNueva.html.includes("Elige proveedor…"),
    "El formulario de órdenes deja elegir proveedor cuando el material no tiene",
    "El formulario de órdenes no ofrece elegir proveedor");
  si(rNueva.html.includes("BOLSA PLASTICA 4X8"),
    "El selector de materiales distingue las variantes",
    "El selector de materiales no muestra el producto con su variante");

  /* ------- 6. crear una orden eligiendo el proveedor en el formulario ------- */
  console.log("6. Proveedor de la orden (caso: el material no tiene ninguno)");
  const materialSinProv = await prisma.material.findFirst({
    where: { proveedorId: null, activo: true },
    orderBy: { codigo: "asc" },
  });
  const proveedorObjetivo = await prisma.proveedor.findFirst({ orderBy: { codigo: "asc" } });
  const proveedorDelMaterial = await prisma.proveedor.findFirst({
    where: { codigo: { not: proveedorObjetivo?.codigo ?? "" } },
    orderBy: { codigo: "asc" },
  });
  if (!materialSinProv || !proveedorObjetivo || !proveedorDelMaterial) {
    throw new Error("Faltan materiales o proveedores para la prueba de órdenes");
  }
  const materialIdPrueba = materialSinProv.id;

  const accionOrden = await accionDe("/ordenes/nueva", "crearOrden", sesiones.compras);

  /** Un renglón de orden. `proveedorId` solo se manda si se elige en el
   *  formulario — así se cubren los dos caminos del servidor. */
  function fdOrden(proveedorId?: number): FormData {
    const fd = new FormData();
    fd.set("1_justificacion", "Prueba e2e de orden");
    fd.set("1_dependencia", "Pruebas");
    fd.set("1_lugar", "Santa Rosa de Copán");
    fd.set("1_materialId", String(materialIdPrueba));
    fd.set("1_cantidad", "2");
    fd.set("1_precio", "1.50");
    if (proveedorId) fd.set("1_proveedorId", String(proveedorId));
    fd.set("0", '[{"error":null},"$K1"]');
    return fd;
  }

  async function llamarOrden(fd: FormData): Promise<{ status: number; texto: string }> {
    const r = await fetch(`${ORIGEN}/ordenes/nueva`, {
      method: "POST",
      headers: {
        Cookie: sesiones.compras,
        "Next-Action": accionOrden,
        "Next-Url": "/ordenes/nueva",
        Origin: ORIGEN,
        Accept: "text/x-component",
      },
      body: fd,
    });
    return { status: r.status, texto: await r.text() };
  }

  const totalBase = await prisma.ordenCompra.count();

  // a) ni el material ni el formulario traen proveedor → se rechaza con aviso
  const rechazo = await llamarOrden(fdOrden());
  const sinProveedor = await prisma.ordenCompra.count();
  si(rechazo.status === 200 && rechazo.texto.includes("Elige el proveedor de la orden") && sinProveedor === totalBase,
    "Sin proveedor en ninguna parte, la orden se rechaza con un aviso claro",
    `La orden sin proveedor no fue rechazada bien (${sinProveedor} vs ${totalBase}): ${rechazo.texto.slice(0, 200)}`);

  // b) se elige proveedor en el formulario → la orden queda con ese proveedor
  const conProveedor = await llamarOrden(fdOrden(proveedorObjetivo.id));
  const orden1 = await prisma.ordenCompra.findFirst({ orderBy: { id: "desc" } });
  si(conProveedor.status === 200 || conProveedor.status === 303,
    "La acción de crear orden respondió",
    `La action de crear orden falló (HTTP ${conProveedor.status}): ${conProveedor.texto.slice(0, 200)}`);
  si(Boolean(orden1) && orden1!.proveedorId === proveedorObjetivo.id,
    `La orden se crea con el proveedor elegido en el formulario (${proveedorObjetivo.codigo})`,
    `La orden no tomó el proveedor del formulario: ${orden1?.proveedorId} ≠ ${proveedorObjetivo.id}`);

  // c) el material sí tiene proveedor y el formulario no manda ninguno →
  //    se usa el del material (el comportamiento de siempre)
  await prisma.material.update({ where: { id: materialSinProv.id }, data: { proveedorId: proveedorDelMaterial.id } });
  const respaldo = await llamarOrden(fdOrden());
  const orden2 = await prisma.ordenCompra.findFirst({ orderBy: { id: "desc" } });
  si((respaldo.status === 200 || respaldo.status === 303)
      && Boolean(orden2) && orden2!.id !== orden1!.id && orden2!.proveedorId === proveedorDelMaterial.id,
    "Si el material sí tiene proveedor, se usa el suyo sin pedirlo en el formulario",
    `No se usó el proveedor del material (${respaldo.status}): ${orden2?.proveedorId} ≠ ${proveedorDelMaterial.id}`);

  /* --------------------------- 7. dejar limpio --------------------------- */
  const folios = [orden1?.folio, orden2?.folio].filter((f): f is string => Boolean(f));
  await prisma.ordenCompra.deleteMany({ where: { id: { in: [orden1!.id, orden2!.id] } } });
  await prisma.material.update({ where: { id: materialSinProv.id }, data: { proveedorId: null } });
  await prisma.movimiento.deleteMany({
    where: { OR: folios.map((f) => ({ detalle: { contains: f } })) },
  });
  await prisma.descargoInventario.deleteMany({ where: { id: descargo.id } });
  await prisma.material.update({ where: { id: material.id }, data: { existencia: existenciaOriginal } });
  await prisma.movimiento.deleteMany({ where: { id: mov.id } });
  console.log("  ✓ Datos de prueba restaurados (órdenes, proveedor del material, existencia y bitácora)\n");

  console.log("TODO CORRECTO — roles, permisos, descargo, catálogo y órdenes verificados.");
}

main().catch((e) => {
  console.error("FALLÓ:", e instanceof Error ? e.message : e);
  process.exit(1);
});
