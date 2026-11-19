-- Área (gerencia) del usuario — Sistema de compras Fundación CAMO
--
-- Agrega a `usuarios` la gerencia a la que pertenece cada persona, con los
-- mismos valores del catálogo de src/lib/dependencias.ts ("direccion",
-- "gerente mercadeo", …). De ahí sale la dependencia que traen las
-- requisiciones y el filtro con el que cada jefe inmediato solo ve y autoriza
-- las de SU área.
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-area-usuario.sql --schema prisma/schema.prisma
--   npx prisma generate

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS "area" TEXT;

COMMENT ON COLUMN usuarios.area IS
  'Gerencia (dependencia) del usuario, valor del catálogo src/lib/dependencias.ts. NULL = sin área asignada.';
