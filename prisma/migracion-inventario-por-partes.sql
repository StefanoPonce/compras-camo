-- Entrega por partes y suma selectiva al inventario.
--
-- Regla nueva al "Registrar entrega" (sub administrador):
--   * Solo entran a la existencia los renglones que NO están "Pendiente de
--     Compra": los Gestionado y los ENTREGADO sí suman.
--   * Se puede registrar la entrega varias veces (llegó parte del material):
--     cada pase suma SOLO los renglones que falten por contar. Para eso nace
--     la columna "inventariado", que evita contar dos veces.
--   * La requisición queda Recibida cuando ya no queda ningún renglón
--     pendiente de compra; mientras tanto sigue Aprobada y lo pendiente sigue
--     visible en el módulo Compras.
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-inventario-por-partes.sql --schema prisma/schema.prisma
--
-- Después hay que regenerar el cliente: npx prisma generate

ALTER TABLE detalle_orden
  ADD COLUMN IF NOT EXISTS "inventariado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "inventariadoEn" TIMESTAMP(3);

-- Renglones de requisiciones YA recibidas con el mecanismo anterior (se
-- sumaba la requisición entera de un solo golpe): esos materiales ya entraron
-- a la existencia, así que se marcan como contados para que un pase nuevo no
-- los vuelva a sumar. Las requisiciones "Recibida" SIN nombre de receptor
-- (las que cerró el módulo Compras con ENTREGADO y nunca se contaron) quedan
-- en false, que es justo lo que falta contar.
UPDATE detalle_orden d
   SET "inventariado" = true,
       "inventariadoEn" = o."fechaRecepcion"
  FROM ordenes_compra o
 WHERE d."ordenId" = o.id
   AND o."estado" = 'Recibida'
   AND o."recibidoPorTxt" IS NOT NULL
   AND d."inventariado" = false;

-- Comprobación.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'detalle_orden' AND column_name = 'inventariado'
  ) THEN
    RAISE EXCEPTION 'No se pudo crear la columna inventariado en detalle_orden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'detalle_orden' AND column_name = 'inventariadoEn'
  ) THEN
    RAISE EXCEPTION 'No se pudo crear la columna inventariadoEn en detalle_orden';
  END IF;

  RAISE NOTICE 'Renglones ya contados en inventario: % · pendientes de contar: %',
    (SELECT COUNT(*) FROM detalle_orden WHERE "inventariado"),
    (SELECT COUNT(*) FROM detalle_orden WHERE NOT "inventariado");
END $$;
