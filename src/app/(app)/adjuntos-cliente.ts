// Preparación de los archivos que el solicitante adjunta a cada renglón de la
// requisición. Las fotos se comprimen antes de subirlas (igual que las del
// catálogo) y los PDF se pasan tal cual, porque comprimirlos sin herramienta
// los dejaría rotos.

import { comprimirImagen } from "./imagenes-cliente";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB por archivo

const FOTOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/** Para el atributo `accept` del input file. */
export const ACEPTA_ADJUNTOS = "image/jpeg,image/png,image/webp,application/pdf";

const TEXTO_TIPOS = "JPG, PNG, WEBP o PDF";

export function esFoto(tipo: string): boolean {
  return FOTOS.includes((tipo || "").toLowerCase());
}

/** Revisa el archivo y devuelve el motivo si no sirve, o null si está bien. */
export function revisarAdjunto(archivo: File): string | null {
  const tipo = (archivo.type || "").toLowerCase();
  if (!esFoto(tipo) && tipo !== "application/pdf") {
    return `Elige una foto o un documento en formato ${TEXTO_TIPOS}.`;
  }
  if (archivo.size > MAX_BYTES) {
    return "Cada archivo puede pesar hasta 8 MB.";
  }
  return null;
}

/**
 * Deja el archivo listo para enviar: las fotos se reducen y comprimen, los PDF
 * se devuelven igual. Lanza si el archivo no es válido, para poder avisarle al
 * solicitante antes de que se envíe la requisición.
 */
export async function prepararAdjunto(archivo: File): Promise<File> {
  const problema = revisarAdjunto(archivo);
  if (problema) throw new Error(problema);
  return esFoto(archivo.type) ? comprimirImagen(archivo) : archivo;
}
