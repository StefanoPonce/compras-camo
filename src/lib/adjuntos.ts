// Subida y borrado de los archivos que el solicitante adjunta a cada renglón
// de la requisición: puede ser una foto o un documento PDF.
//
// Va en un bucket aparte del de las fotos de productos ("requisiciones"),
// porque aquí se suben documentos que además se descargan, no se pintan. El
// bucket se crea público la primera vez para poder abrir el archivo con un
// simple enlace, igual que hace imagenes.ts con el suyo.

const BUCKET = "requisiciones";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB por archivo

const TIPOS_PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export const ACEPTA_ADJUNTOS = "image/jpeg,image/png,image/webp,application/pdf";

/** Texto para el <input accept> y para el error que ve el solicitante. */
export const TIPOS_ADJUNTO_TEXTO = "JPG, PNG, WEBP o PDF";

function configuracion() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !clave) {
    throw new Error(
      "Los adjuntos no están configurados: agrega SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY al archivo .env (claves del proyecto de Supabase → Settings → API)."
    );
  }
  return { base: url.replace(/\/+$/, ""), clave };
}

/** Reconoce un archivo sin depender del global File (no existe en algunos
 *  runtimes de Node) y, si sirve, devuelve su extensión. */
function revisar(valor: unknown): { archivo: File; extension: string } | { archivo: null; error: string } {
  const esArchivo =
    typeof valor === "object" &&
    valor !== null &&
    typeof (valor as File).name === "string" &&
    typeof (valor as File).arrayBuffer === "function";

  if (!esArchivo) return { archivo: null, error: "No se reconoce el archivo adjunto." };
  const archivo = valor as File;

  // Un input file que el usuario no tocó llega con nombre vacío y tamaño 0.
  if (!archivo.name || archivo.size === 0) return { archivo: null, error: "" };

  const tipo = (archivo.type || "").toLowerCase();
  const extension = TIPOS_PERMITIDOS[tipo];
  if (!extension) {
    return { archivo: null, error: `El adjunto debe estar en formato ${TIPOS_ADJUNTO_TEXTO}.` };
  }
  if (archivo.size > MAX_BYTES) {
    return { archivo: null, error: "Cada archivo puede pesar hasta 8 MB." };
  }
  return { archivo, extension };
}

/** Toma todos los adjuntos de un FormData (uno por renglón) y valida cada uno. */
export function leerAdjuntos(datos: FormData): { archivos: (File | null)[]; error: string | null } {
  const archivos: (File | null)[] = [];

  for (const valor of datos.getAll("adjunto")) {
    const revisado = revisar(valor);
    if ("error" in revisado && revisado.error) {
      return { archivos: [], error: revisado.error };
    }
    if ("error" in revisado) {
      archivos.push(null);
    } else {
      archivos.push(revisado.archivo);
    }
  }
  return { archivos, error: null };
}

async function textoDeError(respuesta: Response): Promise<string> {
  const cuerpo = await respuesta.text().catch(() => "");
  try {
    const json = JSON.parse(cuerpo) as { message?: string; error?: string };
    return json.message || json.error || cuerpo || String(respuesta.status);
  } catch {
    return cuerpo || String(respuesta.status);
  }
}

let bucketListo = false;
async function asegurarBucket(base: string, clave: string): Promise<void> {
  if (bucketListo) return;
  const comun = { Authorization: `Bearer ${clave}`, apikey: clave };

  const existe = await fetch(`${base}/storage/v1/bucket/${BUCKET}`, { headers: comun });
  if (!existe.ok) {
    const crea = await fetch(`${base}/storage/v1/bucket`, {
      method: "POST",
      headers: { ...comun, "Content-Type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
    });
    if (!crea.ok && crea.status !== 409 && crea.status !== 400) {
      throw new Error(
        `No se pudo crear el bucket "${BUCKET}" en Supabase Storage: ${await textoDeError(crea)}`
      );
    }
  } else {
    const datos = (await existe.json().catch(() => ({}))) as { public?: boolean };
    if (datos.public !== true) {
      const abre = await fetch(`${base}/storage/v1/bucket/${BUCKET}`, {
        method: "PATCH",
        headers: { ...comun, "Content-Type": "application/json" },
        body: JSON.stringify({ name: BUCKET, public: true }),
      });
      if (!abre.ok) {
        throw new Error(
          `El bucket "${BUCKET}" ya existía pero es privado y no se pudo hacer público: ${await textoDeError(abre)}`
        );
      }
    }
  }
  bucketListo = true;
}

/** Sube el archivo y devuelve su URL pública y el nombre original, que es lo
 *  que se le muestra al solicitante para que sepa qué adjuntó. */
export async function subirAdjunto(
  archivo: File
): Promise<{ url: string; nombre: string }> {
  const { base, clave } = configuracion();
  await asegurarBucket(base, clave);

  const tipo = (archivo.type || "application/pdf").toLowerCase();
  const extension = TIPOS_PERMITIDOS[tipo] || "pdf";
  // El nombre del bucket no guarda el archivo tal cual: se le pone un nombre
  // único para que dos adjuntos con el mismo nombre no se pisen.
  const nombre = `adjunto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const cuerpo = Buffer.from(await archivo.arrayBuffer());

  const respuesta = await fetch(`${base}/storage/v1/object/${BUCKET}/${nombre}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      apikey: clave,
      "Content-Type": tipo,
      "x-upsert": "true",
    },
    body: cuerpo,
  });

  if (!respuesta.ok) {
    throw new Error(`No se pudo subir el archivo a Supabase Storage: ${await textoDeError(respuesta)}`);
  }

  return {
    url: `${base}/storage/v1/object/public/${BUCKET}/${nombre}`,
    // Se limpia la ruta que algunos navegadores agregan por seguridad.
    nombre: archivo.name.split(/[\\/]/).pop() || `adjunto.${extension}`,
  };
}

export function esImagen(tipo: string): boolean {
  return tipo.toLowerCase().startsWith("image/");
}

/** Borra el archivo del storage. Es "best effort": si algo falla se deja el
 *  archivo huérfano, que es preferible a tumbar la operación. */
export async function borrarAdjunto(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marca = `/object/public/${BUCKET}/`;
  const indice = url.indexOf(marca);
  if (indice === -1 || !url.includes("/storage/v1/")) return; // no es un archivo nuestro
  const ruta = url.slice(indice + marca.length);
  if (!ruta || ruta.includes("..")) return;

  try {
    const { base, clave } = configuracion();
    await fetch(`${base}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${clave}`, apikey: clave },
    });
  } catch {
    // Se queda un archivo huérfano en el storage.
  }
}
