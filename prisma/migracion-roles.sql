-- Migración de los roles al nuevo catálogo de 4 roles.
-- Ejecutar con: npx prisma db execute --file prisma/migracion-roles.sql --schema prisma/schema.prisma
--
-- El tipo enum se reconstruye entero porque PostgreSQL no permite quitar
-- valores de un enum. Los usuarios que tenían el rol viejo "usuario" pasan a
-- "responsable_solicitante" (el rol más limitado, solo hace requisiciones).

-- 1) La columna pasa a texto para poder reconstruir el tipo sin datos atados.
--    El default ('usuario') también depende del tipo, así que se quita y se
--    vuelve a poner al final con el rol por defecto nuevo.
ALTER TABLE usuarios ALTER COLUMN rol DROP DEFAULT;
ALTER TABLE usuarios ALTER COLUMN rol TYPE text USING rol::text;

-- 2) Tipo nuevo con los 4 roles del sistema.
DROP TYPE "Rol";
CREATE TYPE "Rol" AS ENUM (
  'administrador',
  'sub_administrador',
  'jefe_inmediato',
  'responsable_solicitante'
);

-- 3) Reasignación de los roles viejos.
UPDATE usuarios SET rol = 'responsable_solicitante' WHERE rol = 'usuario';
UPDATE usuarios SET rol = 'administrador' WHERE rol = 'administrador';

-- 4) La columna vuelve al tipo enum (falla si quedara algún valor fuera de catálogo).
ALTER TABLE usuarios ALTER COLUMN rol TYPE "Rol" USING rol::"Rol";
ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'responsable_solicitante';
