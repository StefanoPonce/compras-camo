-- Agrega la cuenta bancaria del proveedor: el número de cuenta en el que la
-- fundación deposita lo que le compra. Sirve para los pagos, así que se
-- escribe tal como lo da el banco (con guiones o espacios).
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-cuenta-bancaria.sql --schema prisma/schema.prisma
--
-- La columna queda vacía en los proveedores que ya estaban registrados: es un
-- dato que hay que capturar, no algo que se pueda deducir de los datos viejos.

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS "cuentaBancaria" TEXT;

-- Comprobación.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'proveedores' AND column_name = 'cuentaBancaria'
  ) THEN
    RAISE EXCEPTION 'No se pudo crear la columna cuentaBancaria en proveedores';
  END IF;

  RAISE NOTICE 'Proveedores con cuenta bancaria registrada: %',
    (SELECT COUNT(*) FROM proveedores WHERE "cuentaBancaria" IS NOT NULL AND btrim("cuentaBancaria") <> '');
END $$;
