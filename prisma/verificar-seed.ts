// Verificación rápida de lo que cargó la seed (no modifica nada).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [usuarios, proveedores, materiales, categorias] = await Promise.all([
    prisma.usuario.count(),
    prisma.proveedor.count(),
    prisma.material.count(),
    prisma.material.findMany({ select: { categoria: true }, distinct: ["categoria"], orderBy: { categoria: "asc" } }),
  ]);

  console.log(`usuarios     ${usuarios}`);
  console.log(`proveedores  ${proveedores}`);
  console.log(`materiales   ${materiales}`);
  console.log(`categorías   ${categorias.map((c) => c.categoria.slice(0, 28)).join(" | ")}`);

  const sinCodigo = await prisma.proveedor.count({ where: { codigo: null } });
  console.log(`\nproveedores SIN código: ${sinCodigo}  (debe ser 0)`);

  console.log("\nPrimeros proveedores:");
  for (const p of await prisma.proveedor.findMany({ orderBy: { codigo: "asc" }, take: 5 })) {
    console.log(`  ${p.codigo}  ${p.nombre}  ·  ${p.tipoProducto ?? "—"}  ·  ${p.telefono ?? "—"}`);
  }

  // La presentación va dentro del nombre, así que se revisa cómo quedó agrupada
  // por el mismo texto base.
  console.log("\nNombres repetidos (mismo texto, unidades distintas):");
  const todos = await prisma.material.findMany({ select: { codigo: true, nombre: true, unidad: true }, orderBy: { codigo: "asc" } });
  const porNombre = new Map<string, { codigo: string; unidad: string }[]>();
  for (const m of todos) {
    const lista = porNombre.get(m.nombre);
    if (lista) lista.push(m);
    else porNombre.set(m.nombre, [m]);
  }
  const repetidos = [...porNombre.entries()].filter(([, g]) => g.length > 1);
  for (const [nombre, g] of repetidos) {
    console.log(`  «${nombre}» → ${g.map((m) => `${m.codigo}[${m.unidad}]`).join("  ")}`);
  }
  console.log(`  ${repetidos.length} nombre(s) repetido(s)`);

  console.log("\nMateriales sin proveedor (el Excel no lo trae):", await prisma.material.count({ where: { proveedorId: null } }));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
