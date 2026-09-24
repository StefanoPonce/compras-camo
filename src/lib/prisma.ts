// Cliente único de Prisma. Vercel ejecuta la aplicación en funciones
// serverless, por lo que reutilizamos la instancia también en producción para
// no crear un cliente nuevo por cada módulo o solicitud.
import { PrismaClient } from "@prisma/client";

type GlobalConPrisma = typeof globalThis & {
  comprasCamoPrisma?: PrismaClient;
};

const globalParaPrisma = globalThis as GlobalConPrisma;

/**
 * Supabase usa el puerto 6543 para Supavisor en modo transaction. Ese modo
 * multiplexa conexiones, pero no mantiene prepared statements entre
 * transacciones. Aseguramos aquí los parámetros aunque la URL de Vercel se
 * haya guardado sin ellos.
 */
function urlAjustadaParaSupabase(url: string): string {
  try {
    const urlParseada = new URL(url);
    const esPoolerTransactionDeSupabase =
      urlParseada.hostname.endsWith(".pooler.supabase.com") && urlParseada.port === "6543";

    if (esPoolerTransactionDeSupabase) {
      // pgbouncer=true desactiva los prepared statements de Prisma.
      urlParseada.searchParams.set("pgbouncer", "true");
      // Una conexión por instancia es suficiente para una app serverless.
      urlParseada.searchParams.set("connection_limit", "1");
      // Protección adicional contra versiones de Supavisor que todavía
      // intentan reutilizar una sentencia preparada.
      urlParseada.searchParams.set("statement_cache_size", "0");
    }

    return urlParseada.toString();
  } catch {
    // Si una URL válida de otro proveedor no se puede parsear, Prisma.emitirá
    // su diagnóstico habitual en lugar de ocultarlo aquí.
    return url;
  }
}

const urlSinAjustar = process.env.DATABASE_URL;
if (!urlSinAjustar) {
  throw new Error("Falta la variable de entorno DATABASE_URL para conectar Prisma.");
}

const urlParaPrisma = urlAjustadaParaSupabase(urlSinAjustar);

export const prisma =
  globalParaPrisma.comprasCamoPrisma ||
  new PrismaClient({
    datasources: { db: { url: urlParaPrisma } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Guardamos la referencia global tanto en desarrollo como en producción.
// En Vercel, globalThis pertenece a la instancia serverless reutilizada.
globalParaPrisma.comprasCamoPrisma = prisma;
