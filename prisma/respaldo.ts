// Respaldo completo de los datos a JSON antes de borrar la base.
// Uso:  npx tsx prisma/respaldo.ts
// Vuelca todas las tablas con sus relaciones a respaldos/respaldo-<fecha>.json
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const datos = {
    respaldadoEn: new Date().toISOString(),
    usuarios: await prisma.usuario.findMany(),
    proveedores: await prisma.proveedor.findMany(),
    materiales: await prisma.material.findMany(),
    ordenes: await prisma.ordenCompra.findMany({ include: { items: true } }),
    descargos: await prisma.descargoInventario.findMany(),
    movimientos: await prisma.movimiento.findMany(),
  };

  const ruta = join(process.cwd(), "respaldos");
  mkdirSync(ruta, { recursive: true });
  const archivo = join(ruta, `respaldo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`);
  writeFileSync(archivo, JSON.stringify(datos, null, 1), "utf8");

  console.log("Respaldo generado:", archivo);
  console.log(
    `  usuarios ${datos.usuarios.length} · proveedores ${datos.proveedores.length} · ` +
    `materiales ${datos.materiales.length} · órdenes ${datos.ordenes.length} · ` +
    `descargos ${datos.descargos.length} · movimientos ${datos.movimientos.length}`
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
