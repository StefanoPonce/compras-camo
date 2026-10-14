-- El sistema deja de manejar precios: la fundación los lleva por fuera.
--
-- Las columnas NO se borran (quedan intactas por si hay que volver atrás),
-- solo se deja de leerlas y escribirlas desde Prisma. Por eso Prisma ya no
-- las trae en schema.prisma, pero en la base siguen ahí.
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-sin-precios.sql --schema prisma/schema.prisma
--
-- El detalle importante es "precio" de detalle_orden: es NOT NULL y NO tiene
-- default. Como el sistema ya no la envía en los INSERT, sin este default
-- cualquier requisición nueva fallaría con "violates not-null constraint".
-- Las otras dos columnas (total, precioUltimo) ya traen default 0, por eso no
-- necesitan nada aquí.

-- 1) precio de detalle_orden: default 0 para que ya no haga falta mandarla.
ALTER TABLE detalle_orden ALTER COLUMN precio SET DEFAULT 0;

-- 2) Comprobación: las tres columnas siguen existiendo.
DO $$
DECLARE
  faltante TEXT;
BEGIN
  SELECT string_agg(column_name, ', ')
    INTO faltante
    FROM (VALUES ('precio'), ('total'), ('precioUltimo')) AS esperadas(column_name)
   WHERE NOT EXISTS (
     SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'detalle_orden' AND column_name = 'precio'
   )
   OR NOT EXISTS (
     SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ordenes_compra' AND column_name = 'total'
   )
   OR NOT EXISTS (
     SELECT 1
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'materiales' AND column_name = 'precioUltimo'
   );
  IF faltante IS NOT NULL THEN
    RAISE EXCEPTION 'Falta alguna columna de precio: %', faltante;
  END IF;
  RAISE NOTICE 'Migración sin precios aplicada. Las columnas siguen existiendo.';
END $$;
