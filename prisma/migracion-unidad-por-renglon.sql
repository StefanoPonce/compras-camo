-- La unidad de medida pasa a ser de cada renglón de la requisición: el
-- solicitante puede pedir un material en una unidad distinta de la que tiene
-- en el catálogo. De paso se empareja lo que hay escrito en la tabla
-- "materiales", que tenía CAJA y CAJAS, BOTE y BOTES, PAQUETE/PAQUETES/Paquete
-- y UNIDAD y UNIDADES como si fueran unidades diferentes.
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-unidad-por-renglon.sql --schema prisma/schema.prisma
--
-- Solo se cambian textos de unidades: no se borra ni se agrega ningún material.

-- 1) Columna de unidad en el renglón.
ALTER TABLE detalle_orden ADD COLUMN IF NOT EXISTS "unidad" TEXT;

-- 2) Emparejar las unidades del catálogo. Se escriben en mayúsculas y en
--    singular; los plurales pasan a su forma canónica. Una unidad que el
--    catálogo no reconoce se deja como estaba, solo con los espacios de más
--    quitados y en mayúsculas, para no perderla.
UPDATE materiales SET "unidad" = 'UNIDAD'  WHERE btrim("unidad") IN ('UNIDAD', 'UNIDADES');
UPDATE materiales SET "unidad" = 'CAJA'    WHERE btrim("unidad") IN ('CAJA', 'CAJAS');
UPDATE materiales SET "unidad" = 'BOTE'    WHERE btrim("unidad") IN ('BOTE', 'BOTES');
UPDATE materiales SET "unidad" = 'PAQUETE' WHERE btrim("unidad") IN ('PAQUETE', 'PAQUETES');
UPDATE materiales SET "unidad" = upper(btrim("unidad"));

-- 3) Los renglones que ya existían toman la unidad de su material.
UPDATE detalle_orden d
   SET "unidad" = m."unidad"
  FROM materiales m
 WHERE m.id = d."materialId"
   AND (d."unidad" IS NULL OR btrim(d."unidad") = '');

-- 4) A partir de aquí la unidad siempre tiene valor: si algún INSERT futuro
--    se olvida de mandarla, la base pone UNIDAD en vez de dejar un hueco.
UPDATE detalle_orden SET "unidad" = 'UNIDAD' WHERE "unidad" IS NULL OR btrim("unidad") = '';
ALTER TABLE detalle_orden ALTER COLUMN "unidad" SET DEFAULT 'UNIDAD';
ALTER TABLE detalle_orden ALTER COLUMN "unidad" SET NOT NULL;

-- 5) Comprobación.
DO $$
DECLARE
  unidades TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'detalle_orden' AND column_name = 'unidad'
  ) THEN
    RAISE EXCEPTION 'No se pudo crear la columna unidad en detalle_orden';
  END IF;

  SELECT string_agg(DISTINCT "unidad", ' | ') INTO unidades FROM materiales;
  RAISE NOTICE 'Unidades del catálogo ahora: %', unidades;
  RAISE NOTICE 'Renglones actualizados: %',
    (SELECT COUNT(*) FROM detalle_orden WHERE "unidad" = 'UNIDAD');
END $$;
