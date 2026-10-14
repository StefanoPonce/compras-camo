-- Estado "Borrador" para las requisiciones que alguien deja a medio llenar.
-- El borrador guarda lo que ya se escribió (materiales, cantidades,
-- observaciones y adjuntos) y se sigue completando más tarde desde la lista,
-- con el botón "Continuar editando". Mientras es borrador no aparece en la
-- revisión, ni en la consolidación, ni en los reportes.
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-borrador-requisicion.sql --schema prisma/schema.prisma
--
-- No se borra ni se modifica ninguna requisición que ya exista.

-- 1) El estado nuevo. Entra al final del tipo, así que el orden de los estados
--    que ya había no cambia. Lo usan las consultas que filtran por
--    Pendiente/Aprobada/Recibida (consolidación, reportes, recepción), así que
--    ningún borrador se cuela en ellas.
ALTER TYPE "EstadoOrden" ADD VALUE IF NOT EXISTS 'Borrador';

-- 2) El proveedor de la requisición deja de ser obligatorio en la base. Lo
--    normal es empezar a llenar por los materiales y elegir el proveedor al
--    final, así que un borrador tiene que poder guardarse sin él. Las
--    requisiciones ya guardadas no se tocan: este comando solo relaja la
--    columna. Al ENVIAR, el servidor sigue exigiendo proveedor.
ALTER TABLE ordenes_compra ALTER COLUMN "proveedorId" DROP NOT NULL;

-- 3) Comprobación.
DO $$
DECLARE
  estados TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname = 'EstadoOrden' AND e.enumlabel = 'Borrador'
  ) THEN
    RAISE EXCEPTION 'No se pudo agregar el estado Borrador a EstadoOrden';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ordenes_compra'
       AND column_name = 'proveedorId' AND is_nullable <> 'YES'
  ) THEN
    RAISE EXCEPTION 'La columna proveedorId de ordenes_compra sigue siendo obligatoria';
  END IF;

  SELECT string_agg(e.enumlabel, ' | ' ORDER BY e.enumsortorder) INTO estados
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname = 'EstadoOrden';
  RAISE NOTICE 'Estados de una requisición ahora: %', estados;
  RAISE NOTICE 'Requisiciones sin proveedor (solo posibles en borradores): %',
    (SELECT COUNT(*) FROM ordenes_compra WHERE "proveedorId" IS NULL);
END $$;