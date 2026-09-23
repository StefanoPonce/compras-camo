// Redimensiona y comprime la foto del producto ANTES de mandarla al
// servidor. Así el formulario no supera el límite de peso de Next
// (bodySizeLimit) y el bucket de Supabase no se llena de archivos de
// 10 MB que nadie necesita a 1200 px de ancho.
//
// Solo se usa desde componentes de cliente (necesita canvas del DOM).

const LADO_MAXIMO = 1200;
const TAMANO_OBJETIVO = 400_000; // si ya pesa menos que esto, se manda tal cual

function cargarImagen(ruta: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo leer la imagen."));
    img.src = ruta;
  });
}

/** Devuelve la lista de tipos aceptados para el input file. */
export const ACEPTA_IMAGENES = "image/jpeg,image/png,image/webp";

export async function esImagenValida(archivo: File): Promise<string | null> {
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(archivo.type.toLowerCase())) {
    return "Elige una imagen en formato JPG, PNG o WEBP.";
  }
  if (archivo.size > 8 * 1024 * 1024) {
    return "La imagen no puede pesar más de 8 MB.";
  }
  return null;
}

/** Reduce la imagen a como máximo LADO_MAXIMO px de lado y la convierte a
 *  JPEG (o la deja en PNG si venía con transparencia). Devuelve el archivo
 *  original si la compresión no ayuda. */
export async function comprimirImagen(archivo: File): Promise<File> {
  const ruta = URL.createObjectURL(archivo);
  try {
    const img = await cargarImagen(ruta);
    const lado = Math.max(img.naturalWidth, img.naturalHeight);
    const escala = Math.min(1, LADO_MAXIMO / lado);

    if (escala === 1 && archivo.size < TAMANO_OBJETIVO) return archivo;

    const lienzo = document.createElement("canvas");
    lienzo.width = Math.max(1, Math.round(img.naturalWidth * escala));
    lienzo.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = lienzo.getContext("2d");
    if (!ctx) return archivo;

    const esPng = archivo.type === "image/png";
    if (!esPng) {
      // El JPEG no tiene transparencia: se pinta fondo blanco para que no
      // quede negro detrás del producto.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    }
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);

    const blob = await new Promise<Blob | null>((res) =>
      lienzo.toBlob(res, esPng ? "image/png" : "image/jpeg", esPng ? undefined : 0.82)
    );
    if (!blob || blob.size >= archivo.size) return archivo;

    const extension = esPng ? "png" : "jpg";
    const base = archivo.name.replace(/\.[^.]+$/, "") || "imagen";
    return new File([blob], `${base}.${extension}`, { type: blob.type });
  } finally {
    URL.revokeObjectURL(ruta);
  }
}
