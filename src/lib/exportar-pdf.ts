import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Exportación a PDF de los listados (Proveedores, Materiales…).
 *
 * A diferencia del botón de imprimir —que depende del diálogo del navegador y
 * de que el equipo tenga una impresora "Guardar como PDF"— aquí se arma el
 * archivo en el servidor y llega a la carpeta de descargas como cualquier
 * otro archivo: título, encabezado verde de tabla, filas alternas, colores
 * de estado y paginación con el encabezado repetido en cada página.
 *
 * Hoja: A4 apaisado, como las hojas de Excel del mismo listado.
 */

export type ValorPdf = string | number | null | undefined;

export type ColumnaPdf = {
  titulo: string;
  /** Peso relativo del ancho: las columnas se reparten el ancho de la hoja en proporción. */
  peso: number;
  alinear?: "izq" | "der" | "centro";
};

/** Estilo puntual de una celda (Activo/Inactivo, faltantes en rojo…). */
export type EstiloPdf = { fondo?: string; texto?: string; negrita?: boolean };

export type ListadoPdf = {
  titulo: string;
  /** Línea bajo el título: de qué se trata el listado y cuándo se generó. */
  subtitulo: string;
  columnas: ColumnaPdf[];
  filas: ValorPdf[][];
  /** Se le pasa la fila, la columna y el valor ya convertido a texto. */
  celda?: (fila: number, columna: number, valor: string) => EstiloPdf | undefined;
  /** Pie de página (el total, por ejemplo). */
  pie?: string;
};

/* Colores de la interfaz (tailwind.config.ts). */
const VERDE = rgb(0x12 / 255, 0x56 / 255, 0x4a / 255);
const TINTA = rgb(0x17 / 255, 0x21 / 255, 0x1e / 255);
const TINTA2 = rgb(0x5a / 255, 0x66 / 255, 0x61 / 255);
const BORDE = rgb(0xd3 / 255, 0xda / 255, 0xcf / 255);
const SUPERFICIE2 = rgb(0xf7 / 255, 0xf9 / 255, 0xf6 / 255);

/** "#E2EDE9" → rgb() de pdf-lib. */
function color(hex: string) {
  const h = hex.replace("#", "");
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255
  );
}

/**
 * Las fuentes estándar del PDF solo entienden el alfabeto latino y unos pocos
 * signos tipográficos. Lo que no entre se sustituye para que la generación no
 * falle a mitad de una descarga.
 */
function seguro(texto: string): string {
  const mapa: Record<string, string> = {
    "\u2018": "'",
    "\u2019": "'",
    "\u201C": '"',
    "\u201D": '"',
    "\u2013": "-",
    "\u2014": "-",
    "\u2011": "-",
    "\u2022": "*",
    "\u2026": "...",
    "\u00A0": " ",
  };
  return String(texto)
    .replace(/[\u2018\u2019\u201C\u201D\u2013\u2014\u2011\u2022\u2026\u00A0]/g, (c) => mapa[c] ?? "")
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, "?");
}

/** Parte un texto en renglones que caben en el ancho dado. */
function partir(texto: string, ancho: number, fuente: PDFFont, tamano: number): string[] {
  const salida: string[] = [];

  function trocear(palabra: string): string[] {
    const trozos: string[] = [];
    let resto = palabra;
    while (resto) {
      let corte = 0;
      while (corte < resto.length && fuente.widthOfTextAtSize(resto.slice(0, corte + 1), tamano) <= ancho) corte++;
      if (corte === 0) corte = 1; // al menos un carácter para no trabarse
      trozos.push(resto.slice(0, corte));
      resto = resto.slice(corte);
    }
    return trozos;
  }

  for (const parrafo of seguro(texto).split("\n")) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (!palabras.length) {
      salida.push("");
      continue;
    }
    let linea = "";
    for (const palabra of palabras) {
      const candidata = linea ? `${linea} ${palabra}` : palabra;
      if (fuente.widthOfTextAtSize(candidata, tamano) <= ancho) {
        linea = candidata;
        continue;
      }
      if (linea) {
        salida.push(linea);
        linea = "";
      }
      if (fuente.widthOfTextAtSize(palabra, tamano) <= ancho) {
        linea = palabra;
        continue;
      }
      const trozos = trocear(palabra);
      salida.push(...trozos.slice(0, -1));
      linea = trozos[trozos.length - 1];
    }
    salida.push(linea);
  }

  return salida.length ? salida : [""];
}

export async function crearListadoPdf(datos: ListadoPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(datos.titulo);
  pdf.setAuthor("Fundación CAMO");
  pdf.setCreator("Sistema de compras · Fundación CAMO");
  pdf.setCreationDate(new Date());

  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ANCHO = 841.89; // A4 apaisado
  const ALTO = 595.28;
  const MARGEN = 32;
  const ANCHO_UTIL = ANCHO - MARGEN * 2;

  const TAM = 8.4;
  const RENGLON = TAM * 1.35;
  const PAD_X = 5;
  const PAD_Y = 4.5;
  const ALTO_CABECERA_TABLA = 19;
  const ALTO_PIE = 30; // hueco reservado abajo para el pie con el número de página

  const pesoTotal = datos.columnas.reduce((s, c) => s + c.peso, 0) || 1;
  const anchos = datos.columnas.map((c) => (ANCHO_UTIL * c.peso) / pesoTotal);

  /** Título del documento arriba; en las páginas siguientes, solo "continuación". */
  function cabeceraDocumento(p: PDFPage, continuacion: boolean): number {
    const titulo = continuacion ? `${datos.titulo} (continuación)` : datos.titulo;
    const tamanoTitulo = continuacion ? 11 : 15;
    let y = ALTO - MARGEN - tamanoTitulo;
    p.drawText(seguro(titulo), { x: MARGEN, y, size: tamanoTitulo, font: negrita, color: VERDE });
    if (!continuacion) {
      y -= 15;
      p.drawText(seguro(datos.subtitulo), { x: MARGEN, y, size: 9.5, font: normal, color: TINTA2 });
    }
    y -= 9;
    p.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 1.2, color: VERDE });
    return y - 8;
  }

  /** Encabezado verde de la tabla. Devuelve el y en el que empiezan las filas. */
  function cabeceraTabla(p: PDFPage, y: number): number {
    p.drawRectangle({ x: MARGEN, y: y - ALTO_CABECERA_TABLA, width: ANCHO_UTIL, height: ALTO_CABECERA_TABLA, color: VERDE });
    let x = MARGEN;
    datos.columnas.forEach((col, i) => {
      const alineacion = col.alinear || "izq";
      const lineas = partir(col.titulo, anchos[i] - PAD_X * 2, negrita, 8.2);
      lineas.slice(0, 2).forEach((linea, li) => {
        const anchoTexto = negrita.widthOfTextAtSize(linea, 8.2);
        let tx = x + PAD_X;
        if (alineacion === "der") tx = x + anchos[i] - PAD_X - anchoTexto;
        if (alineacion === "centro") tx = x + (anchos[i] - anchoTexto) / 2;
        p.drawText(linea, { x: tx, y: y - 13 - li * 9.5, size: 8.2, font: negrita, color: rgb(1, 1, 1) });
      });
      x += anchos[i];
    });
    return y - ALTO_CABECERA_TABLA;
  }

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = cabeceraTabla(pagina, cabeceraDocumento(pagina, false));

  datos.filas.forEach((fila, indiceFila) => {
    const textos = fila.map((v) => seguro(String(v ?? "")));
    const celdas = textos.map((texto, i) => partir(texto, anchos[i] - PAD_X * 2, normal, TAM));
    const renglones = celdas.reduce((max, lineas) => Math.max(max, lineas.length), 1);
    const altoFila = renglones * RENGLON + PAD_Y * 2;

    // Si la fila no cabe en el hueco que falta, se abre página nueva y se
    // repite el encabezado de la tabla.
    if (y - altoFila < MARGEN + ALTO_PIE) {
      pagina = pdf.addPage([ANCHO, ALTO]);
      y = cabeceraTabla(pagina, cabeceraDocumento(pagina, true));
    }

    const arriba = y;
    const abajo = y - altoFila;

    if (indiceFila % 2 === 1) {
      pagina.drawRectangle({ x: MARGEN, y: abajo, width: ANCHO_UTIL, height: altoFila, color: SUPERFICIE2 });
    }

    let x = MARGEN;
    celdas.forEach((lineas, i) => {
      const estilo = datos.celda?.(indiceFila, i, textos[i]);
      if (estilo?.fondo) {
        pagina.drawRectangle({ x, y: abajo, width: anchos[i], height: altoFila, color: color(estilo.fondo) });
      }
      const fuente = estilo?.negrita ? negrita : normal;
      const tono = estilo?.texto ? color(estilo.texto) : TINTA;
      const alineacion = datos.columnas[i].alinear || "izq";
      lineas.forEach((linea, li) => {
        const anchoTexto = fuente.widthOfTextAtSize(linea, TAM);
        let tx = x + PAD_X;
        if (alineacion === "der") tx = x + anchos[i] - PAD_X - anchoTexto;
        if (alineacion === "centro") tx = x + (anchos[i] - anchoTexto) / 2;
        pagina.drawText(linea, {
          x: tx,
          y: arriba - PAD_Y - TAM - li * RENGLON,
          size: TAM,
          font: fuente,
          color: tono,
        });
      });
      x += anchos[i];
    });

    pagina.drawLine({ start: { x: MARGEN, y: abajo }, end: { x: ANCHO - MARGEN, y: abajo }, thickness: 0.5, color: BORDE });
    y = abajo;
  });

  if (!datos.filas.length) {
    pagina.drawText("No hay registros para mostrar.", {
      x: MARGEN,
      y: y - 14,
      size: 10,
      font: normal,
      color: TINTA2,
    });
  }

  // Pie de todas las páginas: total a la izquierda y número de página a la derecha.
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    p.drawLine({
      start: { x: MARGEN, y: MARGEN - 4 },
      end: { x: ANCHO - MARGEN, y: MARGEN - 4 },
      thickness: 0.5,
      color: BORDE,
    });
    const base = MARGEN - 14;
    if (datos.pie) p.drawText(seguro(datos.pie), { x: MARGEN, y: base, size: 8, font: normal, color: TINTA2 });
    const numero = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(numero, {
      x: ANCHO - MARGEN - normal.widthOfTextAtSize(numero, 8),
      y: base,
      size: 8,
      font: normal,
      color: TINTA2,
    });
  });

  return pdf.save();
}
