// Verificación rápida de lo que cargó la seed (no modifica nada).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [usuarios, proveedores, materiales, conFamilia, conVariante, categorias] = await Promise.all([
    prisma.usuario.count(),
    prisma.proveedor.count(),
    prisma.material.count(),
    prisma.material.count({ where: { familia: { not: null } } }),
    prisma.material.count({ where: { variante: { not: null } } }),
    prisma.material.findMany({ select: { categoria: true }, distinct: ["categoria"], orderBy: { categoria: "asc" } }),
  ]);

  console.log(`usuarios     ${usuarios}`);
  console.log(`proveedores  ${proveedores}`);
  console.log(`materiales   ${materiales}  (${conFamilia} con familia, ${conVariante} con variante)`);
  console.log(`categorías   ${categorias.map((c) => c.categoria.slice(0, 28)).join(" | ")}`);

  const sinCodigo = await prisma.proveedor.count({ where: { codigo: null } });
  console.log(`proveedores SIN código: ${sinCodigo}  (debe ser 0)`);

  console.log("\nPrimeros proveedores:");
  for (const p of await prisma.proveedor.findMany({ orderBy: { codigo: "asc" }, take: 5 })) {
    console.log(`  ${p.codigo}  ${p.nombre}  ·  ${p.tipoProducto ?? "—"}  ·  ${p.telefono ?? "—"}`);
  }

  console.log("\nEjemplo de familia con variantes:");
  const familias = await prisma.material.groupBy({ by: ["familia"], where: { familia: { not: null } }, _count: true });
  const top = familias.sort((a, b) => b._count - a._count)[0];
  console.log(`  ${top?.familia} (${top?._count} variantes)`);
  for (const m of await prisma.material.findMany({ where: { familia: top!.familia }, orderBy: { codigo: "asc" } })) {
    console.log(`    ${m.codigo}  ${m.nombre}  →  ${m.variante ?? "—"}`);
  }

  console.log("\nMateriales sin proveedor (el Excel no lo trae):", await prisma.material.count({ where: { proveedorId: null } }));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
