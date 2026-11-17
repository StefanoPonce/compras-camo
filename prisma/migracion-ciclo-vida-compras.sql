-- Ciclo de vida de un material dentro de la requisición:
--   En proceso de gestión → Gestionado / En proceso de compra → Entregado
--
-- Agrega el contador de COMPRAS (cantidadComprada) aparte del contador de
-- GESTIÓN (cantidadGestionada). Son dos columnas a propósito: si Gestión
-- gestionó 1 de 2 CAFÉ MOLIDO y Compras compra la otra, la fila queda
-- "Gestionado: 1 · Entregado: 1" en vez de perder la mitad que se resolvió
-- desde Gestión. La suma de los dos contadores nunca pasa de `cantidad`.
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-ciclo-vida-compras.sql --schema prisma/schema.prisma
--
-- Después hay que regenerar el cliente: npx prisma generate

-- 1) La columna nueva, con el valor por defecto.
ALTER TABLE detalle_orden
  ADD COLUMN IF NOT EXISTS "cantidadComprada" INTEGER NOT NULL DEFAULT 0;

-- 2) Renglones que ya estaban marcados ENTREGADO: antes "entregado" y
--    "gestionado" eran la misma cifra, así que pasan al contador de compras
--    para que el desglose los muestre como Entregado y la suma de los dos
--    contadores siga cuadrando con la cantidad pedida.
UPDATE detalle_orden
   SET "cantidadComprada" = "cantidad",
       "cantidadGestionada" = 0
 WHERE "estadoGestion" = 'Entregado';

-- Comprobación.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'detalle_orden' AND column_name = 'cantidadComprada'
  ) THEN
    RAISE EXCEPTION 'No se pudo crear la columna cantidadComprada en detalle_orden';
  END IF;

  RAISE NOTICE 'Renglones por estado: Pendiente % · Gestionado % · Entregado % — con compras registradas: %',
    (SELECT COUNT(*) FROM detalle_orden WHERE "estadoGestion" = 'Pendiente'),
    (SELECT COUNT(*) FROM detalle_orden WHERE "estadoGestion" = 'Gestionado'),
    (SELECT COUNT(*) FROM detalle_orden WHERE "estadoGestion" = 'Entregado'),
    (SELECT COUNT(*) FROM detalle_orden WHERE "cantidadComprada" > 0);
END $$;
