-- Permite configurar los módulos visibles para cada usuario.
-- Ejecutar una sola vez en bases que todavía no tengan la columna.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS "modulosPermitidos" TEXT[] NOT NULL DEFAULT ARRAY['__rol__'];
