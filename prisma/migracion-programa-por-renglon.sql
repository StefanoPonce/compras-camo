-- El programa pasa de ser de la requisición a ser de cada renglón, porque una
-- misma requisición puede llevar materiales de varios programas. También se
-- agrega el archivo que el solicitante adjunta por renglón (foto o PDF).
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-programa-por-renglon.sql --schema prisma/schema.prisma
--
-- La columna "programa" de ordenes_compra NO se borra: se deja con el valor
-- que tenía para no perder nada. El sistema ya no la escribe ni la lee; el
-- programa de una requisición se arma con el de sus renglones.

-- 1) Columnas nuevas del renglón.
ALTER TABLE detalle_orden ADD COLUMN IF NOT EXISTS "programa" TEXT;
ALTER TABLE detalle_orden ADD COLUMN IF NOT EXISTS "adjuntoUrl" TEXT;
ALTER TABLE detalle_orden ADD COLUMN IF NOT EXISTS "adjuntoNombre" TEXT;

-- 2) Traspaso: los renglones de las requisiciones que ya tienen programa se
--    quedan con ese mismo programa, para que no se pierdan al pasar al nuevo
--    modelo. Los renglones que no lo tenían quedan en null y se rellenan al
--    editar la requisición.
UPDATE detalle_orden d
   SET "programa" = o."programa"
  FROM ordenes_compra o
 WHERE o.id = d."ordenId"
   AND o."programa" IS NOT NULL
   AND d."programa" IS NULL;

-- 3) Índice para no recorrer todos los renglones al listar los programas
--    distintos de las requisiciones.
CREATE INDEX IF NOT EXISTS detalle_orden_programa_idx ON detalle_orden ("programa");

-- 4) Comprobación: las columnas tienen que haber quedado.
DO $$
DECLARE
  falta TEXT;
BEGIN
  SELECT string_agg(column_name, ', ') INTO falta
    FROM (VALUES ('programa'), ('adjuntoUrl'), ('adjuntoNombre')) AS esperadas(column_name)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'detalle_orden'
        AND column_name = esperadas.column_name
   );
  IF falta IS NOT NULL THEN
    RAISE EXCEPTION 'No se pudieron crear estas columnas en detalle_orden: %', falta;
  END IF;
  RAISE NOTICE 'Programa por renglón y adjuntos listos. Renglones con programa: %',
    (SELECT COUNT(*) FROM detalle_orden WHERE "programa" IS NOT NULL);
END $$;
