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
//  · Material.familia / Material.variante → se derivan con reglas claras
//    (nombres repetidos, tamaños "4X8", "535 ML", paréntesis "(TAMAÑO …)",
//    adjetivos PEQUEÑA/MEDIANA/GRANDE y prefijos comunes). Lo que no calza
//    queda vacío y se completa desde la pantalla de materiales.
//  · Material.categoria → se infiere del primer dígito del código usando
//    las 7 filas de categoría del propio Excel (100, 200, 300… 700).
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EXCEL =
  process.env.CATALOGO_XLSX || "C:/Users/stefa/Downloads/Catalogo de Compras, Proveedores y Roles BD-2026.xlsx";
const LIMPIAR = process.argv.includes("--limpiar");
/** --solo-reporte: lee y deriva, imprime el resumen, pero no escribe nada. */
const SOLO_REPORTE = process.argv.includes("--solo-reporte");

/* ------------------------------- utilidades ------------------------------- */

const limpiar = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const norm = (v: string) => v.normalize("NFC").replace(/\s+/g, " ").trim().toUpperCase();
/** Igual que `norm` pero sin acentos, para comparar encabezados del Excel. */
const claveNorm = (v: string) => norm(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const PREPOSICIONES = new Set([
  "DE", "DEL", "LA", "EL", "LOS", "LAS", "EN", "A", "AL", "CON", "PARA",
  "POR", "Y", "E", "SOBRE", "HASTA", "DESDE", "COMO",
]);

const TAMANIOS = /^(PEQUEÑ[AO]S?|MEDIAN[AO]S?|GRANDES?|JUMBO|GIGANTE)$/;

/** Quita espacios sobrantes, separadores colgados y preposiciones finales
 *  de un candidato a "familia". Devuelve null si no queda nada usable. */
function podarFamilia(texto: string): string | null {
  let x = limpiar(texto).replace(/[\s/\-–—:,.]+$/, "");
  for (;;) {
    const palabras = x.split(" ").filter(Boolean);
    if (palabras.length > 1 && PREPOSICIONES.has(norm(palabras[palabras.length - 1]))) {
      x = palabras.slice(0, -1).join(" ");
      continue;
    }
    break;
  }
  const palabras = x.split(" ").filter(Boolean);
  if (!palabras.length) return null;
  if (palabras.every((p) => PREPOSICIONES.has(norm(p)))) return null;
  return palabras.join(" ");
}

type Regla = "nombres repetidos" | "paréntesis de tamaño" | "adjetivo de tamaño" | "número final" | "prefijo común" | "sin derivar";

type Producto = {
  codigo: string;
  nombre: string;
  unidad: string;
  categoria: string;
  familia: string | null;
  variante: string | null;
  palabras: string[];
  regla: Regla;
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
      familia: null,
      variante: null,
      palabras: b.nombre.split(" ").filter(Boolean),
      regla: "sin derivar",
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

/* ------------------ derivación de familia y variante ------------------ */

/** "BOLSA PLASTICA 4X8" → familia "BOLSA PLASTICA", variante "4X8". */
function partirPorNumero(nombre: string): { familia: string; variante: string } | null {
  const pruebas: RegExp[] = [
    /(\d+\s*[Xx]\s*\d+\s*[A-Za-z]{0,3})\s*$/, // 4X8, 10X12, 40X 25 CM
    /(?:\/\s*)?(\d+(?:[.,]\d+)?\s*(?:UNIDADES?|ML|KG|KGS|GR|LTR?|CM|MM|M|OZ|ONZ|PLG|PULG)S?)\s*(")?\s*$/i, // 535 ML, 5kg, 24 UNIDADES
    /(\d+(?:[.,]\d+)?\s*")\s*$/, // 32"
  ];
  for (const re of pruebas) {
    const m = nombre.match(re);
    if (!m || m.index === undefined) continue;
    const variante = limpiar((m[1] || "") + (m[2] || ""));
    const familia = podarFamilia(nombre.slice(0, m.index));
    if (familia && variante) return { familia, variante };
  }
  return null;
}

function derivarFamilias(productos: Producto[]) {
  /* Regla 1 — el mismo nombre repetido con distinta unidad.
     Ej: "GEL DESINFECTANTE" en BOTE y en GALÓN. */
  const porNombre = new Map<string, Producto[]>();
  for (const p of productos) {
    const lista = porNombre.get(norm(p.nombre));
    if (lista) lista.push(p);
    else porNombre.set(norm(p.nombre), [p]);
  }
  for (const grupo of porNombre.values()) {
    if (grupo.length < 2) continue;
    const unidadesDistintas = new Set(grupo.map((p) => norm(p.unidad))).size > 1;
    for (const p of grupo) {
      p.familia = podarFamilia(p.nombre);
      p.variante = unidadesDistintas ? p.unidad : null;
      p.regla = "nombres repetidos";
    }
  }

  /* Reglas 2-4 — una sola fila. */
  for (const p of productos) {
    if (p.familia) continue;

    const par = p.nombre.match(/\s*\(([^)]*TAMAÑO[^)]*)\)\s*$/i);
    if (par && par.index !== undefined) {
      const familia = podarFamilia(p.nombre.slice(0, par.index));
      const variante = limpiar(par[1]);
      if (familia && variante) {
        p.familia = familia;
        p.variante = variante;
        p.regla = "paréntesis de tamaño";
        continue;
      }
    }

    const idx = p.palabras.findIndex((pal, i) => i > 0 && TAMANIOS.test(norm(pal)));
    if (idx > 0) {
      const familia = podarFamilia(p.palabras.slice(0, idx).join(" "));
      const variante = limpiar(p.palabras.slice(idx).join(" "));
      if (familia && variante) {
        p.familia = familia;
        p.variante = variante;
        p.regla = "adjetivo de tamaño";
        continue;
      }
    }

    const num = partirPorNumero(p.nombre);
    if (num) {
      p.familia = num.familia;
      p.variante = num.variante;
      p.regla = "número final";
    }
  }

  /* Regla 5 — prefijo común de 2+ palabras entre los que aún no tienen familia,
     siempre dentro de la misma categoría y sin terminar en preposición
     (evita familias absurdas como "JUEGO DE"). */
  let pendientes = productos.filter((p) => !p.familia);
  let algo = true;
  while (algo && pendientes.length > 1) {
    algo = false;
    const maxPalabras = Math.max(...pendientes.map((p) => p.palabras.length));

    for (let k = maxPalabras - 1; k >= 2; k--) {
      const grupos = new Map<string, Producto[]>();
      for (const p of pendientes) {
        if (p.palabras.length <= k) continue;
        const clave = norm(p.categoria) + "||" + norm(p.palabras.slice(0, k).join(" "));
        const lista = grupos.get(clave);
        if (lista) lista.push(p);
        else grupos.set(clave, [p]);
      }

      let asigno = false;
      for (const g of grupos.values()) {
        if (g.length < 2) continue;
        const prefijo = podarFamilia(g[0].palabras.slice(0, k).join(" "));
        if (!prefijo || prefijo.split(" ").length < 2) continue;

        const n = prefijo.split(" ").length;
        const validos = g.filter(
          (p) => p.palabras.length > n && norm(p.palabras.slice(0, n).join(" ")) === norm(prefijo),
        );
        if (validos.length < 2) continue;

        for (const p of validos) {
          p.familia = prefijo;
          p.variante = limpiar(p.palabras.slice(n).join(" "));
          p.regla = "prefijo común";
        }
        asigno = true;
      }

      if (asigno) {
        algo = true;
        pendientes = productos.filter((p) => !p.familia);
        break;
      }
    }
  }
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

  derivarFamilias(productos);

  // Nombres repetidos: el Excel trae 12 parejas con el mismo texto pero código
  // distinto. Se listan aquí porque la regla de unicidad del formulario de
  // materiales trabaja sobre el nombre.
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

  if (SOLO_REPORTE) console.log("\nFamilias derivadas (para revisar antes de cargar):");
  if (SOLO_REPORTE) {
    const grupos = new Map<string, Producto[]>();
    for (const p of productos) {
      if (!p.familia) continue;
      const lista = grupos.get(p.familia);
      if (lista) lista.push(p);
      else grupos.set(p.familia, [p]);
    }
    const varios = [...grupos.entries()].filter(([, g]) => g.length > 1).sort((a, b) => b[1].length - a[1].length);
    for (const [familia, g] of varios) {
      console.log(`\n  ${familia} (${g.length})`);
      for (const p of g) console.log(`     ${p.codigo}  ${p.nombre}  →  ${p.variante ?? "—"}  [${p.unidad}]`);
    }
    const solas = [...grupos.values()].filter((g) => g.length === 1).length;
    console.log(`\n  + ${solas} familia(s) con un solo miembro (no se listan).`);

    // Lo que trae números o tamaños y aun así no se derivó: es lo más
    // probable que haya que marcar a mano desde la pantalla de materiales.
    const SENAL = /TAMAÑO|PEQUEÑ|MEDIAN|GRANDE|JUMBO|\d/;
    const sinDerivar = productos.filter((p) => !p.familia && SENAL.test(p.nombre));
    console.log(`\nCon números/tamaños pero sin familia (${sinDerivar.length}) — completar a mano:`);
    for (const p of sinDerivar) console.log(`   ${p.codigo}  ${p.nombre}`);
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
          familia: p.familia,
          variante: p.variante,
          proveedorId: null, // el Excel no relaciona materiales con proveedores
        },
      });
    }
    matCreados++;
  }

  /* ---- reporte ---- */
  const conFamilia = productos.filter((p) => p.familia).length;
  const conVariante = productos.filter((p) => p.variante).length;
  const familias = new Set(productos.map((p) => p.familia).filter(Boolean) as string[]);

  console.log("\nResumen:");
  console.log(`  Proveedores: ${provCreados} creados, ${provSaltados} ya existían`);
  console.log(`               ${provFicticios} con código ficticio generado (PROV-001, PROV-002…)`);

  const ordenReglas: Regla[] = ["nombres repetidos", "paréntesis de tamaño", "adjetivo de tamaño", "número final", "prefijo común", "sin derivar"];
  console.log(`  Materiales:  ${matCreados} creados, ${matSaltados} ya existían`);
  console.log(`               ${conFamilia}/${productos.length} con familia · ${conVariante} con variante · ${familias.size} familias distintas`);
  for (const r of ordenReglas) {
    const n = productos.filter((p) => p.regla === r).length;
    if (n) console.log(`                 ${String(n).padStart(4)}  ${r}`);
  }

  const ejemplos = productos.filter((p) => p.familia).slice(0, 6);
  if (ejemplos.length) {
    console.log("\n  Ejemplos derivados:");
    for (const p of ejemplos) console.log(`    ${p.codigo} ${p.nombre}  →  ${p.familia} / ${p.variante ?? "—"}`);
  }

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
