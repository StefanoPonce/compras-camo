-- Campo "Área de" en la requisición: el área que pide el material (Salud,
-- Laboratorio, Facturación, Almacén…). Se escribe libremente en el
-- formulario y se muestra en la parte superior cuando se visualiza la
-- requisición y en la hoja para imprimir.
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-area-requisicion.sql --schema prisma/schema.prisma
--
-- La columna queda vacía en las requisiciones que ya existían: es un dato que
-- se captura al editar, no algo que se pueda deducir de los datos viejos.
-- Después hay que regenerar el cliente: npx prisma generate

ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS "area" TEXT;

-- Comprobación.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'ordenes_compra' AND column_name = 'area'
  ) THEN
    RAISE EXCEPTION 'No se pudo crear la columna area en ordenes_compra';
  END IF;

  RAISE NOTICE 'Requisiciones con área registrada: %',
    (SELECT COUNT(*) FROM ordenes_compra WHERE "area" IS NOT NULL AND btrim("area") <> '');
END $$;
