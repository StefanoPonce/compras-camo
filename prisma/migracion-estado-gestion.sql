-- Estado de compra de cada renglón de la requisición (detalle_orden):
-- Pendiente (Pendiente de Compra) / Gestionado / Entregado.
--
-- Es lo que permite que Gestión marque cada material como gestionado o
-- pendiente de compra, que Compras recoja los pendientes y que al marcar
-- ENTREGADO la requisición se alimente sola (cuando todos sus renglones
-- quedan Entregados, la requisición pasa a Recibida).
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-estado-gestion.sql --schema prisma/schema.prisma
--
-- La columna nace en Pendiente, que es el estado de todo material recién
-- aprobado. No se toca ningún dato existente.
-- Después hay que regenerar el cliente: npx prisma generate

-- 1) Tipo enum (PostgreSQL no permite IF NOT EXISTS en CREATE TYPE).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE t.typname = 'EstadoGestion' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "EstadoGestion" AS ENUM ('Pendiente', 'Gestionado', 'Entregado');
  END IF;
END $$;

-- 2) La columna en cada renglón, con el valor por defecto.
ALTER TABLE detalle_orden
  ADD COLUMN IF NOT EXISTS "estadoGestion" "EstadoGestion" NOT NULL DEFAULT 'Pendiente';

-- Comprobación.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'detalle_orden' AND column_name = 'estadoGestion'
  ) THEN
    RAISE EXCEPTION 'No se pudo crear la columna estadoGestion en detalle_orden';
  END IF;

  RAISE NOTICE 'Renglones por estado: Pendiente % · Gestionado % · Entregado %',
    (SELECT COUNT(*) FROM detalle_orden WHERE "estadoGestion" = 'Pendiente'),
    (SELECT COUNT(*) FROM detalle_orden WHERE "estadoGestion" = 'Gestionado'),
    (SELECT COUNT(*) FROM detalle_orden WHERE "estadoGestion" = 'Entregado');
END $$;
