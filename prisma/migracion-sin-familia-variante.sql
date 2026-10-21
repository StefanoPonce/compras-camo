-- Quita familia y variante de los materiales: el nombre del material ya trae
-- la presentación completa ("BOLSA PLASTICA 4X8", "AGUA 12 ONZ"), así que
-- esos dos campos eran un dato redundante que nadie iba a mantener.
--
-- Ejecutar con:
--   npx prisma db execute --file prisma/migracion-sin-familia-variante.sql --schema prisma/schema.prisma
--
-- ANTES de borrar se copian a una tabla aparte, por si algún día hay que
-- volver atrás:
--
--   SELECT * FROM materiales_familia_variante_respaldo ORDER BY codigo;
--
-- Cuando ya se confirme que no hacen falta, esa tabla se borra con:
--   DROP TABLE materiales_familia_variante_respaldo;

-- 1) Respaldo de lo que se va a perder (solo las filas que lo tenían).
CREATE TABLE IF NOT EXISTS materiales_familia_variante_respaldo AS
  SELECT id, codigo, nombre, familia, variante
    FROM materiales
   WHERE familia IS NOT NULL OR variante IS NOT NULL;

-- 2) Fuera las columnas.
ALTER TABLE materiales DROP COLUMN IF EXISTS familia;
ALTER TABLE materiales DROP COLUMN IF EXISTS variante;

-- 3) Comprobación.
DO $$
DECLARE
  restantes INTEGER;
  respaldados INTEGER;
BEGIN
  SELECT COUNT(*) INTO restantes
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'materiales'
     AND column_name IN ('familia', 'variante');

  IF restantes > 0 THEN
    RAISE EXCEPTION 'Las columnas familia/variante siguen existiendo en materiales';
  END IF;

  SELECT COUNT(*) INTO respaldados FROM materiales_familia_variante_respaldo;
  RAISE NOTICE 'Materiales: % en total', (SELECT COUNT(*) FROM materiales);
  RAISE NOTICE 'Filas respaldadas antes de borrar: %', respaldados;

  IF respaldados = 0 THEN
    RAISE WARNING 'No había familia/variante que respaldar: revisa que el respaldo esté completo';
  END IF;
END $$;
