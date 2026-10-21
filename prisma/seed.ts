// Carga el catálogo real de la fundación (Excel) en la base de datos.
//
//   npm run prisma:seed           → solo agrega lo que falte, no borra nada
//   npm run prisma:seed:limpiar   → BORRA TODA LA BASE y vuelve a cargar
//
// El Excel vive fuera del repositorio. Para usar otra copia:
//   $env:CATALOGO_XLSX = "C:/otra/ruta/catalogo.xlsx"
//
// Qué hace con las columnas que el Excel no trae:
//  · Proveedor.codigo  → vacío en las 28 filas del archivo, así que inventa
//    códigos PROV-001, PROV-002… (si el Excel trae uno, se respeta).
//  · Material.categoria → se infiere del primer dígito del código usando
//    las 7 filas de categoría del propio Excel (100, 200, 300… 700).
//  · Material.familia / Material.variante → ya no existen: la presentación va
//    dentro del nombre ("BOLSA PLASTICA 4X8", "AGUA 12 ONZ"). Se quitaron con
//    prisma/migracion-sin-familia-variante.sql.
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EXCEL =
  process.env.CATALOGO_XLSX || "C:/Users/stefa/Downloads/Catalogo de Compras, Proveedores y Roles BD-2026.xlsx";
const LIMPIAR = process.argv.includes("--limpiar");
/** --solo-reporte: lee el catálogo, imprime el resumen, pero no escribe nada. */
const SOLO_REPORTE = process.argv.includes("--solo-reporte");

/* ------------------------------- utilidades ------------------------------- */

const limpiar = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const norm = (v: string) => v.normalize("NFC").replace(/\s+/g, " ").trim().toUpperCase();
/** Igual que `norm` pero sin acentos, para comparar encabezados del Excel. */
const claveNorm = (v: string) => norm(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

type Producto = {
  codigo: string;
  nombre: string;
  unidad: string;
  categoria: string;
};

/* ------------------------- lectura del Excel -------------------------- */

function leerExcel() {
  const wb = XLSX.read(readFileSync(EXCEL), { type: "buffer" });

  const filasCat = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets["Catalogo de compras"], {
    header: 1,
    blankrows: false,
  });

  // Las filas de 2 celdas son los títulos de sección (100, 200, 300… 700).
  const categorias = new Map<number, string>();
  const bruto: { codigo: string; nombre: string; unidad: string; num: number | null }[] = [];
  const codigosDeTexto: string[] = [];

  for (const f of filasCat) {
    if (!f || f.length < 2) continue; // títulos tipo "GENERAL CAMO"
    const crudoCodigo = limpiar(f[0]);
    const num = Number(crudoCodigo);
    const esNumero = crudoCodigo !== "" && Number.isFinite(num);
    // La fila de encabezados ("CODIGO", "DESCRIPCIÓN", "UNIDAD") tiene 3 celdas
    // y entraría como si fuera un producto más.
    if (!esNumero && claveNorm(crudoCodigo) === "CODIGO") continue;
    const codigo = esNumero ? String(num) : crudoCodigo;
    const nombre = limpiar(f[1]);
    if (!codigo || !nombre) continue;
    if (!esNumero) codigosDeTexto.push(codigo);

    const esSeccion = f.length === 2 && esNumero && num % 100 === 0;
    if (esSeccion) {
      categorias.set(num, nombre);
      continue;
    }
    bruto.push({ codigo, nombre, unidad: limpiar(f[2]) || "Unidad", num: esNumero ? num : null });
  }

  const productos: Producto[] = bruto.map((b) => {
    const prefijo = b.num === null ? null : Math.floor(b.num / 100) * 100;
    return {
      codigo: b.codigo,
      nombre: b.nombre,
      unidad: b.unidad,
      categoria: (prefijo !== null && categorias.get(prefijo)) || "General",
    };
  });

  // ---- proveedores ----
  const filasProv = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Proveedores"], {
    defval: null,
  });
  const campo = (fila: Record<string, unknown>, ...nombres: string[]) => {
    const porClave = new Map<string, unknown>();
    for (const [k, v] of Object.entries(fila)) porClave.set(claveNorm(k), v);
    for (const n of nombres) {
      const v = porClave.get(claveNorm(n));
      if (v !== null && v !== undefined && limpiar(v)) return limpiar(v);
    }
    return "";
  };

  const proveedores = filasProv
    .map((fila, i) => {
      const codigoExcel = campo(fila, "Código de Proveedor", "Codigo de Proveedor", "Código Proveedor");
      return {
        nombre: campo(fila, "Proveedor", "Nombre"),
        // El Excel deja esta columna vacía en las 28 filas: se inventa un código.
        codigo: codigoExcel || `PROV-${String(i + 1).padStart(3, "0")}`,
        ficticio: !codigoExcel,
        contacto: campo(fila, "Persona Contacto", "Contacto") || null,
        tipoProducto: campo(fila, "Tipo de Producto") || null,
        telefono: campo(fila, "Telefono/Celular", "Teléfono/Celular", "Telefono", "Teléfono") || null,
        correo: campo(fila, "Correo Electrónico", "Correo Electronico", "Correo") || null,
        direccion: campo(fila, "Dirección Fìsica", "Dirección Física", "Direccion Fisica", "Dirección") || null,
      };
    })
    .filter((p) => p.nombre);

  return { productos, proveedores, categorias, codigosDeTexto };
}

/* ------------------------------ carga ------------------------------ */

async function limpiarBase() {
  console.log("\nBorrando TODA la base de datos…");
  const b = await prisma.$transaction([
    prisma.descargoInventario.deleteMany(),
    prisma.movimiento.deleteMany(),
    prisma.detalleOrden.deleteMany(),
    prisma.ordenCompra.deleteMany(),
    prisma.material.deleteMany(),
    prisma.proveedor.deleteMany(),
    prisma.usuario.deleteMany(),
  ]);
  const nombres = ["descargos", "movimientos", "detalle órdenes", "órdenes", "materiales", "proveedores", "usuarios"];
  console.log("  " + nombres.map((n, i) => `${b[i].count} ${n}`).join(" · "));
}

async function crearUsuarios() {
  const claveAdmin = await bcrypt.hash("admin123", 10);
  const claveDemo = await bcrypt.hash("compras123", 10);

  const usuarios = [
    { usuario: "admin", nombre: "Administrador del sistema", rol: "administrador" as const, claveHash: claveAdmin },
    { usuario: "subadmin", nombre: "Sub Administrador de compras", rol: "sub_administrador" as const, claveHash: claveDemo },
    { usuario: "jefe", nombre: "Jefe inmediato", rol: "jefe_inmediato" as const, claveHash: claveDemo },
    { usuario: "compras", nombre: "Responsable de solicitar", rol: "responsable_solicitante" as const, claveHash: claveDemo },
  ];
  for (const u of usuarios) {
    await prisma.usuario.upsert({ where: { usuario: u.usuario }, update: {}, create: u });
  }
  return usuarios.length;
}

async function main() {
  const { productos, proveedores, categorias, codigosDeTexto } = leerExcel();
  if (!productos.length || !proveedores.length) {
    throw new Error(`El Excel no trajo datos (productos: ${productos.length}, proveedores: ${proveedores.length}). Revisa la ruta: ${EXCEL}`);
  }

  console.log(`Catálogo leído: ${EXCEL}`);
  console.log(`  ${productos.length} productos · ${proveedores.length} proveedores · ${categorias.size} categorías`);
  if (codigosDeTexto.length) {
    console.log(`  ⚠ ${codigosDeTexto.length} código(s) que no son números (quedan sin categoría General): ${codigosDeTexto.join(", ")}`);
  }

  // Nombres repetidos: el Excel trae 12 parejas con el mismo texto pero código
  // distinto. Se listan aquí porque la regla de unicidad del formulario de
  // materiales trabaja sobre el nombre junto con la unidad.
  const porNombreDup = new Map<string, Producto[]>();
  for (const p of productos) {
    const lista = porNombreDup.get(norm(p.nombre));
    if (lista) lista.push(p);
    else porNombreDup.set(norm(p.nombre), [p]);
  }
  const duplicados = [...porNombreDup.values()].filter((g) => g.length > 1);
  if (duplicados.length) {
    console.log(`\n⚠ ${duplicados.length} nombre(s) repetido(s) en el Excel (códigos distintos):`);
    for (const g of duplicados) {
      console.log("   " + g.map((p) => `${p.codigo}[${p.unidad}]`).join(" = ") + `  «${g[0].nombre}»`);
    }
  }

  if (SOLO_REPORTE) {
    console.log("\n(--solo-reporte: no se escribió nada en la base)");
  } else {
    if (LIMPIAR) await limpiarBase();
    else console.log("\nSin --limpiar: solo se agrega lo que falte (no se borra nada).");

    await crearUsuarios();
  }

  /* ---- proveedores ---- */
  const existentes = SOLO_REPORTE
    ? []
    : await prisma.proveedor.findMany({ select: { codigo: true, nombre: true } });
  const codigosExistentes = existentes
    .map((p) => p.codigo)
    .filter((c): c is string => Boolean(c));
  const nombresExistentes = new Set(existentes.map((p) => norm(p.nombre)));
  const codigosVistos = new Set<string>(codigosExistentes);

  let provCreados = 0;
  let provSaltados = 0;
  let provFicticios = 0;
  for (const p of proveedores) {
    if (p.ficticio) provFicticios++;
    if (nombresExistentes.has(norm(p.nombre)) || codigosVistos.has(p.codigo)) {
      provSaltados++;
      continue;
    }
    // Si el código inventado ya se usó, se sube el número hasta que dé libre.
    let codigo = p.codigo;
    let n = Number(codigo.replace(/\D+/g, "")) || 0;
    while (codigosVistos.has(codigo)) {
      n++;
      codigo = `PROV-${String(n).padStart(3, "0")}`;
    }
    codigosVistos.add(codigo);
    nombresExistentes.add(norm(p.nombre));
    if (!SOLO_REPORTE) {
      await prisma.proveedor.create({
        data: {
          codigo,
          nombre: p.nombre,
          contacto: p.contacto,
          tipoProducto: p.tipoProducto,
          telefono: p.telefono,
          correo: p.correo,
          direccion: p.direccion,
        },
      });
    }
    provCreados++;
  }

  /* ---- materiales ---- */
  const matsExistentes = SOLO_REPORTE
    ? []
    : await prisma.material.findMany({ select: { codigo: true } });
  const codigosMat = new Set(matsExistentes.map((m) => m.codigo));

  let matCreados = 0;
  let matSaltados = 0;
  for (const p of productos) {
    // La llave es el código, no el nombre: el Excel trae 12 parejas con el
    // mismo nombre y códigos distintos, y las dos filas son producto real.
    if (codigosMat.has(p.codigo)) {
      matSaltados++;
      continue;
    }
    codigosMat.add(p.codigo);
    if (!SOLO_REPORTE) {
      await prisma.material.create({
        data: {
          codigo: p.codigo,
          nombre: p.nombre,
          categoria: p.categoria,
          unidad: p.unidad,
          proveedorId: null, // el Excel no relaciona materiales con proveedores
        },
      });
    }
    matCreados++;
  }

  /* ---- reporte ---- */
  const conImagen = await prisma.material.count({ where: { imagenUrl: { not: null } } }).catch(() => 0);

  console.log("\nResumen:");
  console.log(`  Proveedores: ${provCreados} creados, ${provSaltados} ya existían`);
  console.log(`               ${provFicticios} con código ficticio generado (PROV-001, PROV-002…)`);
  console.log(`  Materiales:  ${matCreados} creados, ${matSaltados} ya existían`);
  if (conImagen) console.log(`               ${conImagen} con imagen`);

  console.log(`\nListo. Cuentas: admin/admin123 · subadmin, jefe, compras/compras123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
