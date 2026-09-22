// Datos iniciales para poder entrar y probar el sistema.
// Ejecutar con: npm run prisma:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const claveAdmin = await bcrypt.hash("admin123", 10);
  const claveUsuario = await bcrypt.hash("compras123", 10);

  await prisma.usuario.upsert({
    where: { usuario: "admin" },
    update: {},
    create: {
      usuario: "admin",
      claveHash: claveAdmin,
      nombre: "Administrador del sistema",
      rol: "administrador",
    },
  });

  await prisma.usuario.upsert({
    where: { usuario: "compras" },
    update: {},
    create: {
      usuario: "compras",
      claveHash: claveUsuario,
      nombre: "Encargado de compras",
      rol: "usuario",
    },
  });

  const proveedores = [
    { nombre: "Distribuidora Médica de Occidente", rtn: "0501199012345", contacto: "Marta Fernández", telefono: "2662-1010", correo: "ventas@dimeoccidente.hn", direccion: "Santa Rosa de Copán" },
    { nombre: "Papelería y Suministros El Progreso", rtn: "0801200567890", contacto: "Luis Zelaya", telefono: "2661-3344", correo: "info@papeleriaprogreso.hn", direccion: "Barrio El Centro" },
    { nombre: "Ferretería La Constructora", rtn: "0401198834567", contacto: "Óscar Rivera", telefono: "2662-7788", correo: "ventas@laconstructora.hn", direccion: "Carretera a San Pedro" },
  ];

  const creados = [];
  for (const p of proveedores) {
    creados.push(await prisma.proveedor.upsert({ where: { rtn: p.rtn }, update: {}, create: p }));
  }

  const materiales = [
    { codigo: "MED-001", nombre: "Guantes de látex talla M", categoria: "Insumo médico", unidad: "Caja de 100", existencia: 24, minimo: 20, precioUltimo: 180, proveedorId: creados[0].id },
    { codigo: "MED-002", nombre: "Mascarilla quirúrgica tricapa", categoria: "Insumo médico", unidad: "Caja de 50", existencia: 12, minimo: 25, precioUltimo: 95, proveedorId: creados[0].id },
    { codigo: "MED-003", nombre: "Alcohol en gel 1 litro", categoria: "Insumo médico", unidad: "Unidad", existencia: 40, minimo: 15, precioUltimo: 75, proveedorId: creados[0].id },
    { codigo: "OFI-001", nombre: "Resma de papel bond carta", categoria: "Papelería", unidad: "Resma", existencia: 8, minimo: 10, precioUltimo: 120, proveedorId: creados[1].id },
    { codigo: "OFI-002", nombre: "Tóner impresora láser negro", categoria: "Papelería", unidad: "Unidad", existencia: 3, minimo: 4, precioUltimo: 1450, proveedorId: creados[1].id },
    { codigo: "FER-001", nombre: "Bombillo LED 12W", categoria: "Mantenimiento", unidad: "Unidad", existencia: 30, minimo: 12, precioUltimo: 65, proveedorId: creados[2].id },
    { codigo: "FER-002", nombre: "Pintura de aceite blanco", categoria: "Mantenimiento", unidad: "Galón", existencia: 5, minimo: 6, precioUltimo: 520, proveedorId: creados[2].id },
  ];

  for (const m of materiales) {
    await prisma.material.upsert({ where: { codigo: m.codigo }, update: {}, create: m });
  }

  console.log("Datos iniciales listos: admin/admin123 y compras/compras123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
