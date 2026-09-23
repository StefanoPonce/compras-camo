// Subida y borrado de las fotos de productos en Supabase Storage.
//
// Se usa la API REST de Storage directamente (no hace falta instalar el
// SDK de Supabase): con la service key del proyecto se crea el bucket la
// primera vez, se sube la imagen y se devuelve su URL pública.
//
// Requiere en el archivo .env:
//   SUPABASE_URL=https://xxxxxxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
//
// IMPORTANTE: la service key nunca se manda al navegador, solo se usa
// aquí en el servidor dentro de las server actions.

const BUCKET = "materiales";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

/** Lee la configuración de Storage desde el .env (con alias por si acaso). */
function configuracion() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !clave) {
    throw new Error(
      "Las imágenes no están configuradas: agrega SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY al archivo .env (claves del proyecto de Supabase → Settings → API)."
    );
  }
  return { base: url.replace(/\/+$/, ""), clave };
}

/** Acepta el archivo que viene del FormData sin depender del global File
 *  (en algunos runtimes de Node ese global no existe). */
function esArchivo(valor: unknown): valor is File {
  return (
    typeof valor === "object" &&
    valor !== null &&
    typeof (valor as File).name === "string" &&
    typeof (valor as File).arrayBuffer === "function"
  );
}

/** Devuelve el archivo de imagen adjunto (o null si no venía) y, si el
 *  archivo no sirve como foto de producto, explica el motivo. */
export function leerImagenAdjunta(datos: FormData): { archivo: File | null; error: string | null } {
  const imagen = datos.get("imagen");
  if (!esArchivo(imagen) || imagen.size === 0) return { archivo: null, error: null };
  if (!TIPOS_PERMITIDOS.includes(imagen.type.toLowerCase())) {
    return { archivo: null, error: "La imagen debe estar en formato JPG, PNG, WEBP o GIF." };
  }
  if (imagen.size > MAX_BYTES) {
    return { archivo: null, error: "La imagen no puede pesar más de 8 MB." };
  }
  return { archivo: imagen, error: null };
}

/** Crea el bucket la primera vez y garantiza que sea público (para poder
 *  ver las fotos desde un <img>). Se acuerda de que ya lo hizo durante el
 *  proceso, así no consulta Storage en cada guardado. */
let bucketListo = false;
async function asegurarBucket(base: string, clave: string): Promise<void> {
  if (bucketListo) return;
  const comun = { Authorization: `Bearer ${clave}`, apikey: clave };

  const existe = await fetch(`${base}/storage/v1/bucket/${BUCKET}`, { headers: comun });
  if (existe.ok) {
    const datos = (await existe.json().catch(() => ({}))) as { public?: boolean };
    if (datos.public === true) {
      bucketListo = true;
      return;
    }
    // El bucket ya existía pero era privado: lo abrimos para lectura.
    const abre = await fetch(`${base}/storage/v1/bucket/${BUCKET}`, {
      method: "PATCH",
      headers: { ...comun, "Content-Type": "application/json" },
      body: JSON.stringify({ name: BUCKET, public: true }),
    });
    if (!abre.ok) {
      throw new Error(
        `El bucket "${BUCKET}" de Supabase Storage existe pero es privado y no se pudo hacer público: ${await textoDeError(abre)}.`
      );
    }
    bucketListo = true;
    return;
  }

  const crea = await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...comun, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!crea.ok && crea.status !== 409 && crea.status !== 400) {
    throw new Error(`No se pudo crear el bucket "${BUCKET}" en Supabase Storage: ${await textoDeError(crea)}`);
  }
  bucketListo = true;
}

async function textoDeError(respuesta: Response): Promise<string> {
  const cuerpo = await respuesta.text().catch(() => "");
  try {
    const json = JSON.parse(cuerpo) as { message?: string; error?: string; statusCode?: string };
    return json.message || json.error || cuerpo || String(respuesta.status);
  } catch {
    return cuerpo || String(respuesta.status);
  }
}

function extensionDe(tipo: string): string {
  const mapa: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return mapa[tipo.toLowerCase()] || "jpg";
}

/** Sube la foto del producto a Supabase Storage y devuelve su URL pública. */
export async function subirImagenMaterial(archivo: File): Promise<string> {
  const { base, clave } = configuracion();
  await asegurarBucket(base, clave);

  const tipo = (archivo.type || "image/jpeg").toLowerCase();
  const nombre = `material-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionDe(tipo)}`;
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
    throw new Error(`No se pudo subir la imagen a Supabase Storage: ${await textoDeError(respuesta)}`);
  }

  return `${base}/storage/v1/object/public/${BUCKET}/${nombre}`;
}

/** Borra la foto del storage. Es "best effort": si algo falla (por
 *  ejemplo que la imagen ya no exista) no se interrumpe la operación. */
export async function borrarImagenMaterial(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marca = `/object/public/${BUCKET}/`;
  const indice = url.indexOf(marca);
  if (indice === -1 || !url.includes("/storage/v1/")) return; // no es una imagen nuestra
  const ruta = url.slice(indice + marca.length);
  if (!ruta || ruta.includes("..")) return;

  try {
    const { base, clave } = configuracion();
    await fetch(`${base}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${clave}`, apikey: clave },
    });
  } catch {
    // Se queda una imagen huérfana en el storage; no vale la pena
    // tumbar la operación por eso.
  }
}
