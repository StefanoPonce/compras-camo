import ExcelJS from "exceljs";

export type ValorExcel = string | number | boolean | null;

export type ColumnaExcel = {
  header: string;
  width: number;
  horizontal?: "left" | "center" | "right";
  numFmt?: string;
};

type ResaltadoCelda = {
  fondo: string;
  texto: string;
  negrita?: boolean;
};

type OpcionesExcel = {
  titulo: string;
  descripcion: string;
  nombreHoja: string;
  columnas: ColumnaExcel[];
  filas: ValorExcel[][];
  textoTotal: string;
  resaltar?: (fila: ValorExcel[], indiceColumna: number) => ResaltadoCelda | undefined;
};

const COLOR_TITULO = "FF12564A";
const COLOR_ENCABEZADO = "FF1F6659";
const COLOR_BORDE = "FFD3DACF";
const COLOR_FILA_ALTERNA = "FFF7F9F6";
const COLOR_TEXTO = "FF17211E";
const COLOR_TEXTO_SUAVE = "FF5A6661";

const bordeCelda = {
  top: { style: "thin" as const, color: { argb: COLOR_BORDE } },
  left: { style: "thin" as const, color: { argb: COLOR_BORDE } },
  bottom: { style: "thin" as const, color: { argb: COLOR_BORDE } },
  right: { style: "thin" as const, color: { argb: COLOR_BORDE } },
};

function letraColumna(numero: number): string {
  let resultado = "";
  let actual = numero;

  while (actual > 0) {
    const resto = (actual - 1) % 26;
    resultado = String.fromCharCode(65 + resto) + resultado;
    actual = Math.floor((actual - 1) / 26);
  }

  return resultado;
}

/** Crea un XLSX con una tabla presentable, filtros y anchos de columna listos. */
export async function crearExcelBonito({
  titulo,
  descripcion,
  nombreHoja,
  columnas,
  filas,
  textoTotal,
  resaltar,
}: OpcionesExcel): Promise<ArrayBuffer> {
  const libro = new ExcelJS.Workbook();
  const fecha = new Date();
  const ultimaColumna = columnas.length;
  const filaEncabezado = 4;
  const primeraFilaDatos = 5;

  libro.creator = "Sistema de Compras — Fundación CAMO";
  libro.lastModifiedBy = "Sistema de Compras — Fundación CAMO";
  libro.created = fecha;
  libro.modified = fecha;
  libro.subject = descripcion;
  libro.title = titulo;

  const hoja = libro.addWorksheet(nombreHoja, {
    properties: {
      tabColor: { argb: COLOR_TITULO },
      defaultRowHeight: 20,
    },
    views: [
      {
        state: "frozen",
        ySplit: filaEncabezado,
        showGridLines: false,
      },
    ],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.5,
        bottom: 0.5,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  columnas.forEach((columna, indice) => {
    hoja.getColumn(indice + 1).width = columna.width;
  });

  hoja.mergeCells(1, 1, 1, ultimaColumna);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = titulo;
  celdaTitulo.font = { name: "Aptos Display", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  celdaTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TITULO } };
  celdaTitulo.alignment = { vertical: "middle", horizontal: "left" };
  hoja.getRow(1).height = 34;

  hoja.mergeCells(2, 1, 2, ultimaColumna);
  const celdaDescripcion = hoja.getCell(2, 1);
  celdaDescripcion.value = `${descripcion} · Generado el ${fecha.toLocaleDateString("es-HN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
  celdaDescripcion.font = { name: "Aptos", size: 10, italic: true, color: { argb: COLOR_TEXTO_SUAVE } };
  celdaDescripcion.alignment = { vertical: "middle", horizontal: "left" };
  hoja.getRow(2).height = 24;
  hoja.getRow(3).height = 8;

  const encabezado = hoja.getRow(filaEncabezado);
  encabezado.values = columnas.map((columna) => columna.header);
  encabezado.height = 30;
  encabezado.eachCell((celda) => {
    celda.font = { name: "Aptos", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
    celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    celda.border = bordeCelda;
  });

  filas.forEach((valores, indiceFila) => {
    const fila = hoja.getRow(primeraFilaDatos + indiceFila);
    fila.values = valores;
    fila.height = 23;

    valores.forEach((valor, indiceColumna) => {
      const columna = columnas[indiceColumna];
      const celda = fila.getCell(indiceColumna + 1);
      const resaltado = resaltar?.(valores, indiceColumna);

      celda.font = {
        name: "Aptos",
        size: 10,
        color: { argb: resaltado?.texto ?? COLOR_TEXTO },
        bold: resaltado?.negrita ?? false,
      };
      celda.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: resaltado?.fondo ?? (indiceFila % 2 === 0 ? "FFFFFFFF" : COLOR_FILA_ALTERNA) },
      };
      celda.alignment = {
        vertical: "middle",
        horizontal: columna.horizontal ?? (typeof valor === "number" ? "right" : "left"),
        wrapText: true,
      };
      celda.border = bordeCelda;
      if (columna.numFmt) celda.numFmt = columna.numFmt;
    });
  });

  const filaTotal = primeraFilaDatos + filas.length;
  hoja.mergeCells(filaTotal, 1, filaTotal, ultimaColumna);
  const celdaTotal = hoja.getCell(filaTotal, 1);
  celdaTotal.value = textoTotal;
  celdaTotal.font = { name: "Aptos", size: 10, bold: true, color: { argb: COLOR_TITULO } };
  celdaTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EDE9" } };
  celdaTotal.alignment = { vertical: "middle", horizontal: "right" };
  hoja.getRow(filaTotal).height = 25;

  if (filas.length > 0) {
    hoja.autoFilter = {
      from: { row: filaEncabezado, column: 1 },
      to: { row: primeraFilaDatos + filas.length - 1, column: ultimaColumna },
    };
  }

  const ultimaLetra = letraColumna(ultimaColumna);
  hoja.pageSetup.printArea = `A1:${ultimaLetra}${filaTotal}`;
  hoja.pageSetup.printTitlesRow = `1:${filaEncabezado}`;
  hoja.headerFooter.oddFooter = "Fundación CAMO — Página &P de &N";

  const archivo = await libro.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true,
  });

  return Uint8Array.from(archivo as unknown as ArrayLike<number>).buffer;
}

export function respuestaExcel(archivo: ArrayBuffer, nombreArchivo: string): Response {
  return new Response(archivo, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
