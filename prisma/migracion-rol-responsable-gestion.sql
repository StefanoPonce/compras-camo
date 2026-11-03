-- Agrega el rol "Responsable de gestión" al catálogo de roles.
-- Ejecutar con: npx prisma db execute --file prisma/migracion-rol-responsable-gestion.sql --schema prisma/schema.prisma
--
-- El rol existe en la matriz de permisos (src/lib/permisos.ts) y en el enum de
-- Prisma; PostgreSQL también necesita el valor en su tipo enum "Rol" para
-- poder guardar usuarios con ese rol.
--
-- Solo agrega el valor: no toca datos existentes. IF NOT EXISTS hace que
-- repetir el archivo no cause error.

ALTER TYPE "Rol" ADD VALUE IF NOT EXISTS 'responsable_gestion';
