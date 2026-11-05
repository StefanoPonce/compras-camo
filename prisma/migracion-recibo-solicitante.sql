-- Confirmación de recibo por producto del solicitante.
--
-- El solicitante de una requisición puede marcar, renglón por renglón, que ya
-- le llegó el material. Es una marca informativa: NO suma al inventario ni
-- cambia el estado de la requisición (eso lo sigue registrando el sub
-- administrador con "Registrar entrega").
--
--   recibidoSolicitante    → true cuando el solicitante lo confirmó
--   recibidoSolicitanteEn   → cuándo lo confirmó (null = sin confirmar)
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-recibo-solicitante.sql --schema prisma/schema.prisma
--
-- Todo nace en false/null: no se altera ningún dato existente.
-- Después hay que regenerar el cliente: npx prisma generate

ALTER TABLE detalle_orden
  ADD COLUMN IF NOT EXISTS "recibidoSolicitante" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recibidoSolicitanteEn" TIMESTAMP(3);

-- Comprobación.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'detalle_orden' AND column_name = 'recibidoSolicitante'
  ) THEN
    RAISE EXCEPTION 'No se pudo crear la columna recibidoSolicitante en detalle_orden';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'detalle_orden' AND column_name = 'recibidoSolicitanteEn'
  ) THEN
    RAISE EXCEPTION 'No se pudo crear la columna recibidoSolicitanteEn en detalle_orden';
  END IF;

  RAISE NOTICE 'Productos confirmados por el solicitante: %',
    (SELECT COUNT(*) FROM detalle_orden WHERE "recibidoSolicitante");
END $$;
